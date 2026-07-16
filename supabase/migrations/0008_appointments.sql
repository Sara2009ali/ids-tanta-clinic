-- Phase 3A: Appointment & Reception foundation.
--
-- Normalized, indexed, audit-tracked schema for appointments. Reuses
-- existing conventions rather than inventing new ones: clinic-scoped RLS
-- via private.current_clinic_id()/current_staff_role() (0001), the shared
-- set_updated_at() trigger (0001), permission-gated writes via
-- private.has_permission() (0005/0007), and a check-constraint enum for
-- `priority` matching how patients.gender is modeled (text + check, not a
-- Postgres enum) for the one field that's genuinely just a small fixed set
-- with no cross-table reuse.
--
-- Scope is deliberately Phase 3A only: appointments + status history +
-- visit types + chairs (assignment and conflict-prevention only, no chair/
-- schedule *management* UI or tables — those are Phase 3B). Billing and
-- Clinical modules are expected to add their own tables that reference
-- appointments.id via foreign key; nothing here needs to change for that.

create extension if not exists "btree_gist";

-- ---------------------------------------------------------------------------
-- appointment_status: shared by appointments and its history table.
-- ---------------------------------------------------------------------------
create type public.appointment_status as enum (
  'scheduled',
  'confirmed',
  'checked_in',
  'waiting',
  'in_treatment',
  'completed',
  'cancelled',
  'no_show'
);

-- ---------------------------------------------------------------------------
-- visit_types: clinic-scoped lookup (not an enum) so a clinic's own visit
-- catalog can grow without a migration. Seeded with sensible defaults per
-- clinic below, and auto-seeded for any clinic created from now on.
-- ---------------------------------------------------------------------------
create table public.visit_types (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  name text not null,
  default_duration_minutes integer not null default 30 check (default_duration_minutes > 0),
  color text not null default '#6366f1',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint visit_types_clinic_name_unique unique (clinic_id, name)
);

create index visit_types_clinic_id_idx on public.visit_types (clinic_id);

create trigger set_updated_at
  before update on public.visit_types
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- chairs: minimal — assignment + conflict prevention only in this phase.
-- No working-hours/schedule concept attached yet (Phase 3B: Chair
-- Management / Doctor Schedule).
-- ---------------------------------------------------------------------------
create table public.chairs (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  label text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chairs_clinic_label_unique unique (clinic_id, label)
);

create index chairs_clinic_id_idx on public.chairs (clinic_id);

create trigger set_updated_at
  before update on public.chairs
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Auto-provision default visit types + chairs for every clinic, present and
-- future, so the appointment booking screen always has something to show
-- without a manual setup step (Phase 3B can add a settings UI to edit
-- these; this just guarantees a sane starting point).
-- ---------------------------------------------------------------------------
create or replace function public.seed_clinic_appointment_defaults()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.visit_types (clinic_id, name, default_duration_minutes, color) values
    (new.id, 'Consultation', 30, '#6366f1'),
    (new.id, 'Cleaning', 30, '#22c55e'),
    (new.id, 'Filling', 45, '#f59e0b'),
    (new.id, 'Root Canal', 60, '#ef4444'),
    (new.id, 'Follow-up', 15, '#8b5cf6'),
    (new.id, 'Emergency', 30, '#dc2626')
  on conflict (clinic_id, name) do nothing;

  insert into public.chairs (clinic_id, label) values
    (new.id, 'Chair 1'),
    (new.id, 'Chair 2')
  on conflict (clinic_id, label) do nothing;

  return new;
end;
$$;

create trigger seed_clinic_appointment_defaults
  after insert on public.clinics
  for each row execute function public.seed_clinic_appointment_defaults();

-- Backfill for clinics that already exist (the trigger only fires on future inserts).
insert into public.visit_types (clinic_id, name, default_duration_minutes, color)
select c.id, v.name, v.duration, v.color
from public.clinics c
cross join (values
  ('Consultation', 30, '#6366f1'),
  ('Cleaning', 30, '#22c55e'),
  ('Filling', 45, '#f59e0b'),
  ('Root Canal', 60, '#ef4444'),
  ('Follow-up', 15, '#8b5cf6'),
  ('Emergency', 30, '#dc2626')
) as v(name, duration, color)
on conflict (clinic_id, name) do nothing;

insert into public.chairs (clinic_id, label)
select c.id, ch.label
from public.clinics c
cross join (values ('Chair 1'), ('Chair 2')) as ch(label)
on conflict (clinic_id, label) do nothing;

-- ---------------------------------------------------------------------------
-- appointments.
-- ---------------------------------------------------------------------------
create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  patient_id uuid not null references public.patients (id) on delete restrict,
  doctor_id uuid not null references public.staff_profiles (id) on delete restrict,
  chair_id uuid references public.chairs (id) on delete set null,
  visit_type_id uuid not null references public.visit_types (id) on delete restrict,
  scheduled_start timestamptz not null,
  scheduled_end timestamptz not null,
  status public.appointment_status not null default 'scheduled',
  priority text not null default 'normal' check (priority in ('normal', 'high', 'urgent')),
  is_emergency boolean not null default false,
  chief_complaint text,
  notes text,
  created_by uuid references public.staff_profiles (id) on delete set null,
  updated_by uuid references public.staff_profiles (id) on delete set null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint appointments_end_after_start check (scheduled_end > scheduled_start)
);

create index appointments_clinic_id_idx on public.appointments (clinic_id);
create index appointments_patient_id_idx on public.appointments (patient_id);
create index appointments_doctor_scheduled_start_idx on public.appointments (doctor_id, scheduled_start);
create index appointments_chair_scheduled_start_idx on public.appointments (chair_id, scheduled_start);
create index appointments_status_idx on public.appointments (status);
create index appointments_scheduled_start_idx on public.appointments (scheduled_start);

create trigger set_updated_at
  before update on public.appointments
  for each row execute function public.set_updated_at();

-- Database-level double-booking prevention (the real guarantee — app-level
-- validation in Module 4 is only there to give a fast, friendly error
-- before ever reaching this constraint, since two concurrent requests can't
-- both race past a plain SELECT-then-INSERT check).
alter table public.appointments
  add constraint appointments_doctor_no_overlap
  exclude using gist (
    doctor_id with =,
    tstzrange(scheduled_start, scheduled_end) with &&
  ) where (status not in ('cancelled', 'no_show') and deleted_at is null);

alter table public.appointments
  add constraint appointments_chair_no_overlap
  exclude using gist (
    chair_id with =,
    tstzrange(scheduled_start, scheduled_end) with &&
  ) where (chair_id is not null and status not in ('cancelled', 'no_show') and deleted_at is null);

-- ---------------------------------------------------------------------------
-- appointment_status_history: append-only, auto-populated by trigger so it
-- can never drift from the actual status column, regardless of which code
-- path changes it.
-- ---------------------------------------------------------------------------
create table public.appointment_status_history (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments (id) on delete cascade,
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  from_status public.appointment_status,
  to_status public.appointment_status not null,
  changed_by uuid references public.staff_profiles (id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

create index appointment_status_history_appointment_id_idx on public.appointment_status_history (appointment_id);
create index appointment_status_history_clinic_id_idx on public.appointment_status_history (clinic_id);

create or replace function public.log_appointment_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.appointment_status_history (appointment_id, clinic_id, from_status, to_status, changed_by)
    values (new.id, new.clinic_id, null, new.status, coalesce(new.created_by, new.updated_by));
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
    insert into public.appointment_status_history (appointment_id, clinic_id, from_status, to_status, changed_by)
    values (new.id, new.clinic_id, old.status, new.status, coalesce(new.updated_by, new.created_by));
  end if;
  return new;
end;
$$;

create trigger log_appointment_status_change
  after insert or update on public.appointments
  for each row execute function public.log_appointment_status_change();

-- ---------------------------------------------------------------------------
-- RLS. Reads are open to any clinic staff (every seeded role has
-- appointments.view); writes require the matching permission on top of
-- clinic tenancy — identical shape to the patients policies.
-- ---------------------------------------------------------------------------
alter table public.visit_types enable row level security;
alter table public.chairs enable row level security;
alter table public.appointments enable row level security;
alter table public.appointment_status_history enable row level security;

create policy "clinic staff can view visit types"
  on public.visit_types for select
  to authenticated
  using (clinic_id = (select private.current_clinic_id()) or (select private.current_staff_role()) = 'super_admin');

create policy "admins can manage visit types"
  on public.visit_types for all
  to authenticated
  using (
    (select private.current_staff_role()) = 'super_admin'
    or (clinic_id = (select private.current_clinic_id()) and (select private.current_staff_role()) = 'admin')
  )
  with check (
    (select private.current_staff_role()) = 'super_admin'
    or (clinic_id = (select private.current_clinic_id()) and (select private.current_staff_role()) = 'admin')
  );

create policy "clinic staff can view chairs"
  on public.chairs for select
  to authenticated
  using (clinic_id = (select private.current_clinic_id()) or (select private.current_staff_role()) = 'super_admin');

create policy "admins can manage chairs"
  on public.chairs for all
  to authenticated
  using (
    (select private.current_staff_role()) = 'super_admin'
    or (clinic_id = (select private.current_clinic_id()) and (select private.current_staff_role()) = 'admin')
  )
  with check (
    (select private.current_staff_role()) = 'super_admin'
    or (clinic_id = (select private.current_clinic_id()) and (select private.current_staff_role()) = 'admin')
  );

create policy "clinic staff can view appointments"
  on public.appointments for select
  to authenticated
  using (clinic_id = (select private.current_clinic_id()) or (select private.current_staff_role()) = 'super_admin');

create policy "authorized staff can create appointments"
  on public.appointments for insert
  to authenticated
  with check (
    (clinic_id = (select private.current_clinic_id()) or (select private.current_staff_role()) = 'super_admin')
    and (select private.has_permission('appointments.create'))
  );

create policy "authorized staff can update appointments"
  on public.appointments for update
  to authenticated
  using (clinic_id = (select private.current_clinic_id()) or (select private.current_staff_role()) = 'super_admin')
  with check (
    (clinic_id = (select private.current_clinic_id()) or (select private.current_staff_role()) = 'super_admin')
    and (select private.has_permission('appointments.edit'))
  );

create policy "clinic staff can view appointment status history"
  on public.appointment_status_history for select
  to authenticated
  using (clinic_id = (select private.current_clinic_id()) or (select private.current_staff_role()) = 'super_admin');

-- No insert/update/delete policy for appointment_status_history: it's only
-- ever written by the log_appointment_status_change() trigger, which runs
-- SECURITY DEFINER and so bypasses RLS for its own internal bookkeeping —
-- the same pattern used by assign_patient_number() in 0001/0004.

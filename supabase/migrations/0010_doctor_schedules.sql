-- Phase 3B, Milestone 2: Doctor Schedule Management.
--
-- Reuses established conventions exactly: clinic-scoped RLS via
-- private.current_clinic_id()/current_staff_role() (0001), the shared
-- set_updated_at() trigger (0001), and the "admins can manage X" RLS shape
-- already used for chairs/visit_types (0008) — doctor schedules are the
-- same kind of clinic-configuration data, not patient/clinical data, so
-- they get the same admin-only write policy rather than the
-- has_permission()-gated shape used for appointments themselves.
--
-- Three tables, each independently optional per doctor:
--   doctor_weekly_hours       recurring template, multiple rows per
--                             doctor/day representing split shifts — a
--                             break is just the gap between two blocks,
--                             so no separate "breaks" table is needed.
--   doctor_vacations          date-range rows; any date in range is a
--                             full day off (a single-day "off" is just a
--                             vacation with start_date = end_date).
--   doctor_schedule_exceptions single-date hour overrides (e.g. a half
--                             day) that replace the weekly template for
--                             that one date.
--
-- A doctor with zero rows across all three tables is deliberately left
-- fully unconstrained by the application layer (falls back to the
-- existing flat DEFAULT_CLINIC_HOURS in validation.ts) — configuring a
-- schedule is opt-in per doctor, not a retroactive lockout for doctors
-- nobody has configured yet.

create table public.doctor_weekly_hours (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  doctor_id uuid not null references public.staff_profiles (id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  start_minutes integer not null check (start_minutes >= 0 and start_minutes < 1440),
  end_minutes integer not null check (end_minutes > start_minutes and end_minutes <= 1440),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index doctor_weekly_hours_clinic_id_idx on public.doctor_weekly_hours (clinic_id);
create index doctor_weekly_hours_doctor_day_idx on public.doctor_weekly_hours (doctor_id, day_of_week);

create trigger set_updated_at
  before update on public.doctor_weekly_hours
  for each row execute function public.set_updated_at();

-- Blocks overlapping/duplicate hour blocks for the same doctor on the same
-- weekday at the database level — same technique as the appointments
-- double-booking guarantee in 0008 (requires btree_gist, already enabled).
alter table public.doctor_weekly_hours
  add constraint doctor_weekly_hours_no_overlap
  exclude using gist (
    doctor_id with =,
    day_of_week with =,
    int4range(start_minutes, end_minutes) with &&
  );

create table public.doctor_vacations (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  doctor_id uuid not null references public.staff_profiles (id) on delete cascade,
  start_date date not null,
  end_date date not null check (end_date >= start_date),
  reason text,
  created_by uuid references public.staff_profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index doctor_vacations_clinic_id_idx on public.doctor_vacations (clinic_id);
create index doctor_vacations_doctor_range_idx on public.doctor_vacations (doctor_id, start_date, end_date);

create table public.doctor_schedule_exceptions (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  doctor_id uuid not null references public.staff_profiles (id) on delete cascade,
  exception_date date not null,
  start_minutes integer not null check (start_minutes >= 0 and start_minutes < 1440),
  end_minutes integer not null check (end_minutes > start_minutes and end_minutes <= 1440),
  reason text,
  created_by uuid references public.staff_profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index doctor_schedule_exceptions_clinic_id_idx on public.doctor_schedule_exceptions (clinic_id);
create index doctor_schedule_exceptions_doctor_date_idx
  on public.doctor_schedule_exceptions (doctor_id, exception_date);

-- ---------------------------------------------------------------------------
-- RLS — identical shape to chairs/visit_types: any clinic staff can read,
-- only admins (or super_admin) can write.
-- ---------------------------------------------------------------------------
alter table public.doctor_weekly_hours enable row level security;
alter table public.doctor_vacations enable row level security;
alter table public.doctor_schedule_exceptions enable row level security;

create policy "clinic staff can view doctor weekly hours"
  on public.doctor_weekly_hours for select
  to authenticated
  using (clinic_id = (select private.current_clinic_id()) or (select private.current_staff_role()) = 'super_admin');

create policy "admins can manage doctor weekly hours"
  on public.doctor_weekly_hours for all
  to authenticated
  using (
    (select private.current_staff_role()) = 'super_admin'
    or (clinic_id = (select private.current_clinic_id()) and (select private.current_staff_role()) = 'admin')
  )
  with check (
    (select private.current_staff_role()) = 'super_admin'
    or (clinic_id = (select private.current_clinic_id()) and (select private.current_staff_role()) = 'admin')
  );

create policy "clinic staff can view doctor vacations"
  on public.doctor_vacations for select
  to authenticated
  using (clinic_id = (select private.current_clinic_id()) or (select private.current_staff_role()) = 'super_admin');

create policy "admins can manage doctor vacations"
  on public.doctor_vacations for all
  to authenticated
  using (
    (select private.current_staff_role()) = 'super_admin'
    or (clinic_id = (select private.current_clinic_id()) and (select private.current_staff_role()) = 'admin')
  )
  with check (
    (select private.current_staff_role()) = 'super_admin'
    or (clinic_id = (select private.current_clinic_id()) and (select private.current_staff_role()) = 'admin')
  );

create policy "clinic staff can view doctor schedule exceptions"
  on public.doctor_schedule_exceptions for select
  to authenticated
  using (clinic_id = (select private.current_clinic_id()) or (select private.current_staff_role()) = 'super_admin');

create policy "admins can manage doctor schedule exceptions"
  on public.doctor_schedule_exceptions for all
  to authenticated
  using (
    (select private.current_staff_role()) = 'super_admin'
    or (clinic_id = (select private.current_clinic_id()) and (select private.current_staff_role()) = 'admin')
  )
  with check (
    (select private.current_staff_role()) = 'super_admin'
    or (clinic_id = (select private.current_clinic_id()) and (select private.current_staff_role()) = 'admin')
  );

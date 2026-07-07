-- Phase 1 foundation schema: clinics, staff/RBAC, patients, audit log.
-- Appointments/clinical/financial/recall modules are deliberately deferred
-- to their own phases so their schemas can be designed against real
-- workflow decisions instead of guessed up front.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Helper: shared updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- clinics (multi-tenant root)
-- ---------------------------------------------------------------------------
create table public.clinics (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  timezone text not null default 'Africa/Cairo',
  phone text,
  address text,
  logo_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
  before update on public.clinics
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- staff_profiles (RBAC)
-- ---------------------------------------------------------------------------
create type public.staff_role as enum (
  'super_admin',
  'admin',
  'doctor',
  'assistant',
  'reception',
  'accounting'
);

create table public.staff_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  clinic_id uuid references public.clinics (id) on delete restrict,
  full_name text not null,
  role public.staff_role not null,
  phone text,
  avatar_url text,
  is_active boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- only super_admin may operate without a home clinic
  constraint staff_profiles_clinic_required_unless_super_admin
    check (clinic_id is not null or role = 'super_admin')
);

create index staff_profiles_clinic_id_idx on public.staff_profiles (clinic_id);

create trigger set_updated_at
  before update on public.staff_profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS helper: current staff member's clinic (SECURITY DEFINER to avoid
-- recursive RLS evaluation and to allow caching via the wrapping `select`).
-- ---------------------------------------------------------------------------
create schema if not exists private;

create or replace function private.current_clinic_id()
returns uuid
language sql
security definer
stable
set search_path = ''
as $$
  select clinic_id from public.staff_profiles where id = auth.uid()
$$;

create or replace function private.current_staff_role()
returns public.staff_role
language sql
security definer
stable
set search_path = ''
as $$
  select role from public.staff_profiles where id = auth.uid()
$$;

alter table public.clinics enable row level security;
alter table public.staff_profiles enable row level security;

create policy "staff can read their own clinic"
  on public.clinics for select
  to authenticated
  using (id = (select private.current_clinic_id()) or (select private.current_staff_role()) = 'super_admin');

create policy "staff can read colleagues in their clinic"
  on public.staff_profiles for select
  to authenticated
  using (clinic_id = (select private.current_clinic_id()) or (select private.current_staff_role()) = 'super_admin');

create policy "admins can manage staff in their clinic"
  on public.staff_profiles for all
  to authenticated
  using (
    (select private.current_staff_role()) = 'super_admin'
    or (
      clinic_id = (select private.current_clinic_id())
      and (select private.current_staff_role()) in ('admin')
    )
  )
  with check (
    (select private.current_staff_role()) = 'super_admin'
    or (
      clinic_id = (select private.current_clinic_id())
      and (select private.current_staff_role()) in ('admin')
    )
  );

-- ---------------------------------------------------------------------------
-- clinic_counters: backs human-friendly, per-clinic sequential patient numbers
-- ---------------------------------------------------------------------------
create table public.clinic_counters (
  clinic_id uuid primary key references public.clinics (id) on delete cascade,
  next_patient_number integer not null default 1
);

-- ---------------------------------------------------------------------------
-- patients
-- ---------------------------------------------------------------------------
create type public.patient_status as enum ('active', 'inactive');

create table public.patients (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  patient_number text not null,
  full_name text not null,
  date_of_birth date,
  gender text check (gender in ('male', 'female', 'other', 'unspecified')),
  phone text,
  email text,
  address text,
  emergency_contact_name text,
  emergency_contact_phone text,
  insurance_provider text,
  insurance_policy_number text,
  status public.patient_status not null default 'active',
  tags text[] not null default '{}',
  created_by uuid references public.staff_profiles (id) on delete set null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint patients_clinic_patient_number_unique unique (clinic_id, patient_number)
);

create index patients_clinic_id_idx on public.patients (clinic_id);

create trigger set_updated_at
  before update on public.patients
  for each row execute function public.set_updated_at();

-- Assigns the next per-clinic patient_number atomically on insert.
create or replace function public.assign_patient_number()
returns trigger
language plpgsql
as $$
declare
  next_number integer;
begin
  if new.patient_number is not null then
    return new;
  end if;

  insert into public.clinic_counters (clinic_id, next_patient_number)
  values (new.clinic_id, 2)
  on conflict (clinic_id) do update
    set next_patient_number = public.clinic_counters.next_patient_number + 1
  returning next_patient_number - 1 into next_number;

  new.patient_number := to_char(next_number, 'FM000000');
  return new;
end;
$$;

create trigger assign_patient_number
  before insert on public.patients
  for each row execute function public.assign_patient_number();

-- ---------------------------------------------------------------------------
-- patient_clinical_info (1:1)
-- ---------------------------------------------------------------------------
create table public.patient_clinical_info (
  patient_id uuid primary key references public.patients (id) on delete cascade,
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  medical_conditions text[] not null default '{}',
  allergies text[] not null default '{}',
  current_medications text[] not null default '{}',
  dental_history text,
  chief_complaint text,
  notes text,
  updated_at timestamptz not null default now()
);

create index patient_clinical_info_clinic_id_idx on public.patient_clinical_info (clinic_id);

create trigger set_updated_at
  before update on public.patient_clinical_info
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- patient_medical_alerts
-- ---------------------------------------------------------------------------
create type public.alert_severity as enum ('info', 'warning', 'critical');

create table public.patient_medical_alerts (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  label text not null,
  severity public.alert_severity not null default 'warning',
  created_by uuid references public.staff_profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index patient_medical_alerts_patient_id_idx on public.patient_medical_alerts (patient_id);
create index patient_medical_alerts_clinic_id_idx on public.patient_medical_alerts (clinic_id);

-- ---------------------------------------------------------------------------
-- patient_files
-- ---------------------------------------------------------------------------
create type public.patient_file_type as enum ('photo', 'radiograph', 'pdf', 'consent_form', 'other');

create table public.patient_files (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  file_type public.patient_file_type not null,
  storage_path text not null,
  uploaded_by uuid references public.staff_profiles (id) on delete set null,
  description text,
  uploaded_at timestamptz not null default now()
);

create index patient_files_patient_id_idx on public.patient_files (patient_id);
create index patient_files_clinic_id_idx on public.patient_files (clinic_id);

-- ---------------------------------------------------------------------------
-- audit_log
-- ---------------------------------------------------------------------------
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid references public.clinics (id) on delete set null,
  actor_id uuid references public.staff_profiles (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  changes jsonb,
  created_at timestamptz not null default now()
);

create index audit_log_clinic_id_idx on public.audit_log (clinic_id);
create index audit_log_entity_idx on public.audit_log (entity_type, entity_id);

-- ---------------------------------------------------------------------------
-- RLS: clinic-scoped tables
-- ---------------------------------------------------------------------------
alter table public.patients enable row level security;
alter table public.patient_clinical_info enable row level security;
alter table public.patient_medical_alerts enable row level security;
alter table public.patient_files enable row level security;
alter table public.audit_log enable row level security;

create policy "clinic staff can access their patients"
  on public.patients for all
  to authenticated
  using (clinic_id = (select private.current_clinic_id()) or (select private.current_staff_role()) = 'super_admin')
  with check (clinic_id = (select private.current_clinic_id()) or (select private.current_staff_role()) = 'super_admin');

create policy "clinic staff can access their patients' clinical info"
  on public.patient_clinical_info for all
  to authenticated
  using (clinic_id = (select private.current_clinic_id()) or (select private.current_staff_role()) = 'super_admin')
  with check (clinic_id = (select private.current_clinic_id()) or (select private.current_staff_role()) = 'super_admin');

create policy "clinic staff can access their patients' medical alerts"
  on public.patient_medical_alerts for all
  to authenticated
  using (clinic_id = (select private.current_clinic_id()) or (select private.current_staff_role()) = 'super_admin')
  with check (clinic_id = (select private.current_clinic_id()) or (select private.current_staff_role()) = 'super_admin');

create policy "clinic staff can access their patients' files"
  on public.patient_files for all
  to authenticated
  using (clinic_id = (select private.current_clinic_id()) or (select private.current_staff_role()) = 'super_admin')
  with check (clinic_id = (select private.current_clinic_id()) or (select private.current_staff_role()) = 'super_admin');

create policy "clinic staff can read their audit log"
  on public.audit_log for select
  to authenticated
  using (clinic_id = (select private.current_clinic_id()) or (select private.current_staff_role()) = 'super_admin');

create policy "clinic staff can write audit log entries"
  on public.audit_log for insert
  to authenticated
  with check (clinic_id = (select private.current_clinic_id()) or (select private.current_staff_role()) = 'super_admin');

-- ---------------------------------------------------------------------------
-- Storage: patient files (photos, radiographs, PDFs, consent forms).
-- Convention: objects are stored at "{clinic_id}/{patient_id}/{filename}" so
-- storage RLS can scope access by the same clinic_id check used everywhere
-- else, without a join back to patient_files.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('patient-files', 'patient-files', false)
on conflict (id) do nothing;

create policy "clinic staff can read their patient files"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'patient-files'
    and (
      (select private.current_staff_role()) = 'super_admin'
      or (storage.foldername(name))[1] = (select private.current_clinic_id())::text
    )
  );

create policy "clinic staff can upload their patient files"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'patient-files'
    and (
      (select private.current_staff_role()) = 'super_admin'
      or (storage.foldername(name))[1] = (select private.current_clinic_id())::text
    )
  );

create policy "clinic staff can delete their patient files"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'patient-files'
    and (
      (select private.current_staff_role()) = 'super_admin'
      or (storage.foldername(name))[1] = (select private.current_clinic_id())::text
    )
  );

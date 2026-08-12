-- Doctors & Procedures Catalog, Phase 1 (Database Foundation) — Doctors.
--
-- Doctors remain staff_profiles rows (legacy role = 'doctor', RBAC role key
-- 'dentist') — no parallel `doctors` table, per the approved architecture.
-- This adds a 1:1 extension table for the clinical/profile fields
-- staff_profiles was never meant to carry: identity/auth fields (full_name,
-- phone, role, avatar_url) stay on staff_profiles since every role shares
-- them; specialty/license/bio/etc. are doctor-specific. Same 1:1-extension
-- shape as patient_clinical_info (0001_phase1_foundation.sql): the primary
-- key doubles as the FK, ON DELETE CASCADE off the parent, clinic_id
-- denormalized onto the row for RLS simplicity instead of joining through
-- staff_profiles on every policy check.
--
-- Deliberately no trigger/constraint restricting rows to role = 'doctor':
-- staff_profiles.role can change over time (e.g. a doctor promoted to
-- admin), and a rigid DB-level check would force an awkward delete/
-- recreate dance the application doesn't need. "Only offer this form for
-- doctor-role staff" is an app-layer boundary owned by the (not-yet-built)
-- doctors settings UI, the same way "can't book an appointment in the
-- past" is an app-layer rule rather than a database constraint.
--
-- color defaults to the same '#6366f1' visit_types.color already uses
-- (0008_appointments.sql), for calendar-color consistency with the rest of
-- the scheduling UI. No DB-level hex-format check, matching visit_types'
-- own column exactly — format validation is a zod-schema concern
-- (visit-type-schema.ts's regex), not a database one, in this codebase.
create table public.doctor_profiles (
  doctor_id uuid primary key references public.staff_profiles (id) on delete cascade,
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  specialty text,
  license_number text,
  bio text,
  color text not null default '#6366f1',
  default_visit_type_id uuid references public.visit_types (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index doctor_profiles_clinic_id_idx on public.doctor_profiles (clinic_id);

create trigger set_updated_at
  before update on public.doctor_profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS. Read shape matches staff_profiles' own "staff can read colleagues in
-- their clinic" (0001) — doctor profile info (specialty, bio) is directory
-- data useful to any clinic staff member scheduling or referring a patient,
-- not something to restrict further. Write shape matches staff_profiles'
-- own "admins can manage staff in their clinic" (0001) exactly: role-based
-- admin-only, since doctor_profiles is staff data, not clinical or
-- financial data with its own permission key. No DELETE policy for
-- authenticated — same as patient_clinical_info and the doctor-schedule
-- tables (0010): rows only ever disappear via the ON DELETE CASCADE off a
-- hard-deleted staff_profiles row, which this schema's soft-delete
-- convention (deleted_at) means essentially never happens in practice.
-- ---------------------------------------------------------------------------
alter table public.doctor_profiles enable row level security;

create policy "clinic staff can view doctor profiles"
  on public.doctor_profiles for select
  to authenticated
  using (clinic_id = (select private.current_clinic_id()) or (select private.current_staff_role()) = 'super_admin');

create policy "admins can create doctor profiles"
  on public.doctor_profiles for insert
  to authenticated
  with check (
    (select private.current_staff_role()) = 'super_admin'
    or (clinic_id = (select private.current_clinic_id()) and (select private.current_staff_role()) = 'admin')
  );

create policy "admins can update doctor profiles"
  on public.doctor_profiles for update
  to authenticated
  using (
    (select private.current_staff_role()) = 'super_admin'
    or (clinic_id = (select private.current_clinic_id()) and (select private.current_staff_role()) = 'admin')
  )
  with check (
    (select private.current_staff_role()) = 'super_admin'
    or (clinic_id = (select private.current_clinic_id()) and (select private.current_staff_role()) = 'admin')
  );

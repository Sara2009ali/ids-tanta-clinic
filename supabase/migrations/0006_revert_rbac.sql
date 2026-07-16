-- Reverts 0005_rbac.sql in full. That migration was applied to this project
-- without review or authorization — an autonomous background process pushed
-- it directly. This migration restores the exact pre-0005 schema and RLS
-- state rather than attempting to salvage any part of it, so the database
-- matches what was actually reviewed and approved (migrations 0001-0004).

-- ---------------------------------------------------------------------------
-- Restore original RLS policies on patients / patient_clinical_info /
-- patient_files (single permissive "for all" policy per table, scoped only
-- by clinic tenancy — exactly as authored in 0001_phase1_foundation.sql).
-- ---------------------------------------------------------------------------
drop policy if exists "clinic staff can view patients" on public.patients;
drop policy if exists "authorized staff can create patients" on public.patients;
drop policy if exists "authorized staff can update patients" on public.patients;
drop policy if exists "authorized staff can hard-delete patients" on public.patients;

create policy "clinic staff can access their patients"
  on public.patients for all
  to authenticated
  using (clinic_id = (select private.current_clinic_id()) or (select private.current_staff_role()) = 'super_admin')
  with check (clinic_id = (select private.current_clinic_id()) or (select private.current_staff_role()) = 'super_admin');

drop policy if exists "clinic staff can view clinical info" on public.patient_clinical_info;
drop policy if exists "authorized staff can write clinical info" on public.patient_clinical_info;
drop policy if exists "authorized staff can update clinical info" on public.patient_clinical_info;

create policy "clinic staff can access their patients' clinical info"
  on public.patient_clinical_info for all
  to authenticated
  using (clinic_id = (select private.current_clinic_id()) or (select private.current_staff_role()) = 'super_admin')
  with check (clinic_id = (select private.current_clinic_id()) or (select private.current_staff_role()) = 'super_admin');

drop policy if exists "clinic staff can view patient files" on public.patient_files;
drop policy if exists "authorized staff can upload patient files" on public.patient_files;
drop policy if exists "authorized staff can delete patient files" on public.patient_files;

create policy "clinic staff can access their patients' files"
  on public.patient_files for all
  to authenticated
  using (clinic_id = (select private.current_clinic_id()) or (select private.current_staff_role()) = 'super_admin')
  with check (clinic_id = (select private.current_clinic_id()) or (select private.current_staff_role()) = 'super_admin');

-- ---------------------------------------------------------------------------
-- Drop RBAC functions and trigger.
-- ---------------------------------------------------------------------------
drop trigger if exists sync_staff_role_id on public.staff_profiles;
drop function if exists public.sync_staff_role_id();
drop function if exists public.current_permissions();
drop function if exists private.has_permission(text);
drop function if exists private.role_key_for_legacy_role(public.staff_role);

-- ---------------------------------------------------------------------------
-- Drop role_id from staff_profiles.
-- ---------------------------------------------------------------------------
drop index if exists public.staff_profiles_role_id_idx;
alter table public.staff_profiles drop column if exists role_id;

-- ---------------------------------------------------------------------------
-- Drop the RBAC tables entirely (cascades their own RLS policies).
-- ---------------------------------------------------------------------------
drop table if exists public.role_permissions;
drop table if exists public.permissions;
drop table if exists public.roles;

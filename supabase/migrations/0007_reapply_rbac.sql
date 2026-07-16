-- Phase 2.1 (reapplied): Role-Based Access Control.
--
-- 0005_rbac.sql introduced this schema. It was reverted by
-- 0006_revert_rbac.sql (an out-of-band rollback applied to the live project
-- without this session's involvement). Per migration best practice, history
-- is never edited or deleted — 0005 and 0006 stay exactly as they are, and
-- this migration reintroduces the same schema as a new, forward-only step.
--
-- This file intentionally does not just re-run 0005 verbatim: every
-- statement below is written defensively (IF NOT EXISTS / OR REPLACE /
-- ON CONFLICT DO NOTHING / DROP ... IF EXISTS before CREATE) so it is safe
-- to apply regardless of the exact current state of the remote database —
-- whether that's "cleanly reverted by 0006" (the expected case) or a
-- partially-applied state from any other manual intervention in between.
-- Re-running this migration a second time is also a no-op, not an error.
--
-- Design is unchanged from 0005: `roles`/`permissions`/`role_permissions`
-- are data-driven tables (not enums) so new roles/permissions can be added
-- with plain inserts, never a code change. `staff_profiles.role_id` is a
-- nullable FK auto-backfilled from the legacy `role` enum, which is kept
-- untouched for backward compatibility. See docs/RBAC.md for the full
-- design rationale.

-- ---------------------------------------------------------------------------
-- Tables.
-- ---------------------------------------------------------------------------
create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  label text not null,
  description text,
  is_system boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.permissions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  label text not null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.role_permissions (
  role_id uuid not null references public.roles (id) on delete cascade,
  permission_id uuid not null references public.permissions (id) on delete cascade,
  primary key (role_id, permission_id)
);

create index if not exists role_permissions_permission_id_idx on public.role_permissions (permission_id);

alter table public.staff_profiles
  add column if not exists role_id uuid references public.roles (id) on delete set null;

create index if not exists staff_profiles_role_id_idx on public.staff_profiles (role_id);

-- ---------------------------------------------------------------------------
-- Seed roles (8 requested for Phase 2.1). ON CONFLICT so re-running this
-- migration, or running it after a partial prior attempt, never errors.
-- ---------------------------------------------------------------------------
insert into public.roles (key, label, description, is_system) values
  ('super_admin', 'Super Admin', 'Unrestricted access across all clinics.', true),
  ('admin', 'Admin', 'Full access within their own clinic.', true),
  ('dentist', 'Dentist', 'Clinical staff who treat patients.', true),
  ('receptionist', 'Receptionist', 'Front-desk scheduling and patient registration.', true),
  ('reception_manager', 'Reception Manager', 'Supervises front-desk staff; can archive/delete records and view billing.', true),
  ('dental_assistant', 'Dental Assistant', 'Supports clinical staff during treatment.', true),
  ('accountant', 'Accountant', 'Billing and financial records.', true),
  ('viewer', 'Viewer', 'Read-only access for audits or observers.', true)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Seed the permission catalog. Appointments/clinical/billing/reports/
-- settings keys are registered now (modules not built yet) so those phases
-- inherit RBAC from day one instead of retrofitting it.
-- ---------------------------------------------------------------------------
insert into public.permissions (key, label) values
  ('patients.view', 'View patients'),
  ('patients.create', 'Create patients'),
  ('patients.edit', 'Edit patients'),
  ('patients.delete', 'Delete (soft-delete) patients'),
  ('appointments.view', 'View appointments'),
  ('appointments.create', 'Create appointments'),
  ('appointments.edit', 'Edit appointments'),
  ('appointments.cancel', 'Cancel appointments'),
  ('clinical.view', 'View clinical records'),
  ('clinical.edit', 'Edit clinical records'),
  ('billing.view', 'View billing/invoices'),
  ('billing.edit', 'Edit billing/invoices'),
  ('reports.view', 'View reports'),
  ('settings.manage', 'Manage clinic settings')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Role -> permission mapping. ON CONFLICT DO NOTHING on the composite PK
-- makes this safe to re-run.
-- ---------------------------------------------------------------------------
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.key in ('super_admin', 'admin')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.key = 'dentist' and p.key in (
  'patients.view', 'patients.create', 'patients.edit',
  'appointments.view', 'appointments.create', 'appointments.edit', 'appointments.cancel',
  'clinical.view', 'clinical.edit',
  'reports.view'
)
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.key = 'receptionist' and p.key in (
  'patients.view', 'patients.create', 'patients.edit',
  'appointments.view', 'appointments.create', 'appointments.edit', 'appointments.cancel'
)
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.key = 'reception_manager' and p.key in (
  'patients.view', 'patients.create', 'patients.edit', 'patients.delete',
  'appointments.view', 'appointments.create', 'appointments.edit', 'appointments.cancel',
  'billing.view', 'reports.view'
)
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.key = 'dental_assistant' and p.key in (
  'patients.view', 'patients.edit',
  'appointments.view',
  'clinical.view'
)
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.key = 'accountant' and p.key in (
  'patients.view',
  'billing.view', 'billing.edit',
  'reports.view'
)
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.key = 'viewer' and p.key in (
  'patients.view', 'appointments.view', 'clinical.view', 'billing.view', 'reports.view'
)
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Backfill role_id for existing staff from the legacy enum, and keep it in
-- sync on future inserts/updates that only set `role` (e.g. the seed
-- script), so no existing app code has to change to participate in RBAC.
-- ---------------------------------------------------------------------------
create or replace function private.role_key_for_legacy_role(p_role public.staff_role)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_role
    when 'super_admin' then 'super_admin'
    when 'admin' then 'admin'
    when 'doctor' then 'dentist'
    when 'assistant' then 'dental_assistant'
    when 'reception' then 'receptionist'
    when 'accounting' then 'accountant'
  end
$$;

update public.staff_profiles sp
set role_id = r.id
from public.roles r
where sp.role_id is null
  and r.key = private.role_key_for_legacy_role(sp.role);

create or replace function public.sync_staff_role_id()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role_id is null then
    select id into new.role_id
    from public.roles
    where key = private.role_key_for_legacy_role(new.role);
  end if;
  return new;
end;
$$;

drop trigger if exists sync_staff_role_id on public.staff_profiles;
create trigger sync_staff_role_id
  before insert or update of role, role_id on public.staff_profiles
  for each row execute function public.sync_staff_role_id();

-- ---------------------------------------------------------------------------
-- Permission-check functions (see 0005_rbac.sql for full rationale).
-- ---------------------------------------------------------------------------
create or replace function public.current_permissions()
returns setof text
language sql
stable
security definer
set search_path = ''
as $$
  select p.key
  from public.permissions p
  where (select private.current_staff_role()) = 'super_admin'
  union
  select p.key
  from public.staff_profiles sp
  join public.role_permissions rp on rp.role_id = sp.role_id
  join public.permissions p on p.id = rp.permission_id
  where sp.id = auth.uid()
$$;

revoke all on function public.current_permissions from public;
grant execute on function public.current_permissions to authenticated;

create or replace function private.has_permission(p_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.current_permissions() perm where perm = p_key)
$$;

-- ---------------------------------------------------------------------------
-- patients / patient_clinical_info / patient_files RLS: reads stay open to
-- any clinic staff member; writes also require the matching permission.
-- patients.delete gates the soft-delete transition (deleted_at null -> not
-- null); patients.edit gates everything else (including archive/restore).
-- Every CREATE POLICY below is preceded by DROP POLICY IF EXISTS so this
-- migration can run against either the pre-0005 state (only the original
-- "for all" policy exists) or a partially-applied state, without erroring.
-- ---------------------------------------------------------------------------
drop policy if exists "clinic staff can access their patients" on public.patients;
drop policy if exists "clinic staff can view patients" on public.patients;
drop policy if exists "authorized staff can create patients" on public.patients;
drop policy if exists "authorized staff can update patients" on public.patients;
drop policy if exists "authorized staff can hard-delete patients" on public.patients;

create policy "clinic staff can view patients"
  on public.patients for select
  to authenticated
  using (clinic_id = (select private.current_clinic_id()) or (select private.current_staff_role()) = 'super_admin');

create policy "authorized staff can create patients"
  on public.patients for insert
  to authenticated
  with check (
    (clinic_id = (select private.current_clinic_id()) or (select private.current_staff_role()) = 'super_admin')
    and (select private.has_permission('patients.create'))
  );

create policy "authorized staff can update patients"
  on public.patients for update
  to authenticated
  using (clinic_id = (select private.current_clinic_id()) or (select private.current_staff_role()) = 'super_admin')
  with check (
    (clinic_id = (select private.current_clinic_id()) or (select private.current_staff_role()) = 'super_admin')
    and (select private.has_permission('patients.edit'))
    and (deleted_at is null or (select private.has_permission('patients.delete')))
  );

create policy "authorized staff can hard-delete patients"
  on public.patients for delete
  to authenticated
  using (
    (clinic_id = (select private.current_clinic_id()) or (select private.current_staff_role()) = 'super_admin')
    and (select private.has_permission('patients.delete'))
  );

drop policy if exists "clinic staff can access their patients' clinical info" on public.patient_clinical_info;
drop policy if exists "clinic staff can view clinical info" on public.patient_clinical_info;
drop policy if exists "authorized staff can write clinical info" on public.patient_clinical_info;
drop policy if exists "authorized staff can update clinical info" on public.patient_clinical_info;

create policy "clinic staff can view clinical info"
  on public.patient_clinical_info for select
  to authenticated
  using (clinic_id = (select private.current_clinic_id()) or (select private.current_staff_role()) = 'super_admin');

create policy "authorized staff can write clinical info"
  on public.patient_clinical_info for insert
  to authenticated
  with check (
    (clinic_id = (select private.current_clinic_id()) or (select private.current_staff_role()) = 'super_admin')
    and (select private.has_permission('patients.edit'))
  );

create policy "authorized staff can update clinical info"
  on public.patient_clinical_info for update
  to authenticated
  using (clinic_id = (select private.current_clinic_id()) or (select private.current_staff_role()) = 'super_admin')
  with check (
    (clinic_id = (select private.current_clinic_id()) or (select private.current_staff_role()) = 'super_admin')
    and (select private.has_permission('patients.edit'))
  );

drop policy if exists "clinic staff can access their patients' files" on public.patient_files;
drop policy if exists "clinic staff can view patient files" on public.patient_files;
drop policy if exists "authorized staff can upload patient files" on public.patient_files;
drop policy if exists "authorized staff can delete patient files" on public.patient_files;

create policy "clinic staff can view patient files"
  on public.patient_files for select
  to authenticated
  using (clinic_id = (select private.current_clinic_id()) or (select private.current_staff_role()) = 'super_admin');

create policy "authorized staff can upload patient files"
  on public.patient_files for insert
  to authenticated
  with check (
    (clinic_id = (select private.current_clinic_id()) or (select private.current_staff_role()) = 'super_admin')
    and (select private.has_permission('patients.edit'))
  );

create policy "authorized staff can delete patient files"
  on public.patient_files for delete
  to authenticated
  using (
    (clinic_id = (select private.current_clinic_id()) or (select private.current_staff_role()) = 'super_admin')
    and (select private.has_permission('patients.edit'))
  );

-- ---------------------------------------------------------------------------
-- roles/permissions/role_permissions: readable by any authenticated staff
-- member; not writable through the API in this phase (migration/service-
-- role only — no role-management UI exists yet).
-- ---------------------------------------------------------------------------
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;

drop policy if exists "authenticated can read roles" on public.roles;
create policy "authenticated can read roles"
  on public.roles for select
  to authenticated
  using (true);

drop policy if exists "authenticated can read permissions" on public.permissions;
create policy "authenticated can read permissions"
  on public.permissions for select
  to authenticated
  using (true);

drop policy if exists "authenticated can read role_permissions" on public.role_permissions;
create policy "authenticated can read role_permissions"
  on public.role_permissions for select
  to authenticated
  using (true);

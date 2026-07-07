-- Phase 2.1: Role-Based Access Control.
--
-- Adds a data-driven roles/permissions system alongside the existing
-- `staff_role` enum (kept as-is for backward compatibility — display labels,
-- the `admins can manage staff` policy, and scripts/seed-auth-users.ts all
-- still work unchanged). Going forward, authorization decisions should check
-- *permissions* via role_permissions rather than the legacy enum, so new
-- roles or permissions can be introduced with plain data inserts instead of
-- application code changes.
--
-- Design:
--   roles            – dynamic role catalog (key, label, description)
--   permissions       – dynamic permission catalog ("resource.action" keys)
--   role_permissions  – many-to-many mapping, editable without code changes
--   staff_profiles.role_id – FK into roles, auto-backfilled from the legacy
--                            `role` enum by a trigger so existing insert
--                            paths (seed script) keep working untouched.

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  label text not null,
  description text,
  is_system boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.permissions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  label text not null,
  description text,
  created_at timestamptz not null default now()
);

create table public.role_permissions (
  role_id uuid not null references public.roles (id) on delete cascade,
  permission_id uuid not null references public.permissions (id) on delete cascade,
  primary key (role_id, permission_id)
);

create index role_permissions_permission_id_idx on public.role_permissions (permission_id);

alter table public.staff_profiles
  add column role_id uuid references public.roles (id) on delete set null;

create index staff_profiles_role_id_idx on public.staff_profiles (role_id);

-- ---------------------------------------------------------------------------
-- Seed roles. Keys/labels match the roster requested for Phase 2.1; the
-- legacy enum values (super_admin/admin/doctor/assistant/reception/
-- accounting) map onto these via the backfill below.
-- ---------------------------------------------------------------------------
insert into public.roles (key, label, description, is_system) values
  ('super_admin', 'Super Admin', 'Unrestricted access across all clinics.', true),
  ('admin', 'Admin', 'Full access within their own clinic.', true),
  ('dentist', 'Dentist', 'Clinical staff who treat patients.', true),
  ('receptionist', 'Receptionist', 'Front-desk scheduling and patient registration.', true),
  ('reception_manager', 'Reception Manager', 'Supervises front-desk staff; can archive/delete records and view billing.', true),
  ('dental_assistant', 'Dental Assistant', 'Supports clinical staff during treatment.', true),
  ('accountant', 'Accountant', 'Billing and financial records.', true),
  ('viewer', 'Viewer', 'Read-only access for audits or observers.', true);

-- ---------------------------------------------------------------------------
-- Seed the permission catalog requested for Phase 2.1. Modules not built yet
-- (appointments/clinical/billing/reports/settings) get their permission keys
-- registered now so those phases can rely on RBAC from day one instead of
-- retrofitting it.
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
  ('settings.manage', 'Manage clinic settings');

-- ---------------------------------------------------------------------------
-- Role -> permission mapping.
-- super_admin/admin get every permission that exists today (and, via
-- public.current_permissions() below, every permission added in the future
-- too — see the union with the super_admin bypass there).
-- ---------------------------------------------------------------------------
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.key in ('super_admin', 'admin');

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.key = 'dentist' and p.key in (
  'patients.view', 'patients.create', 'patients.edit',
  'appointments.view', 'appointments.create', 'appointments.edit', 'appointments.cancel',
  'clinical.view', 'clinical.edit',
  'reports.view'
);

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.key = 'receptionist' and p.key in (
  'patients.view', 'patients.create', 'patients.edit',
  'appointments.view', 'appointments.create', 'appointments.edit', 'appointments.cancel'
);

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.key = 'reception_manager' and p.key in (
  'patients.view', 'patients.create', 'patients.edit', 'patients.delete',
  'appointments.view', 'appointments.create', 'appointments.edit', 'appointments.cancel',
  'billing.view', 'reports.view'
);

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.key = 'dental_assistant' and p.key in (
  'patients.view', 'patients.edit',
  'appointments.view',
  'clinical.view'
);

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.key = 'accountant' and p.key in (
  'patients.view',
  'billing.view', 'billing.edit',
  'reports.view'
);

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.key = 'viewer' and p.key in (
  'patients.view', 'appointments.view', 'clinical.view', 'billing.view', 'reports.view'
);

-- ---------------------------------------------------------------------------
-- Backfill role_id for existing staff from the legacy enum, and keep it in
-- sync on future inserts/updates that only set `role` (e.g. the seed script)
-- so no existing app code has to change to start participating in RBAC.
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

create trigger sync_staff_role_id
  before insert or update of role, role_id on public.staff_profiles
  for each row execute function public.sync_staff_role_id();

-- ---------------------------------------------------------------------------
-- Permission-check functions.
--
-- public.current_permissions(): the full permission-key set for the calling
-- user — callable via supabase.rpc() from the application so Server
-- Components can gate navigation/buttons without hardcoding role checks.
-- Super_admin gets *every* permission in the catalog (not just what's
-- explicitly mapped), so future permissions added by later phases are
-- automatically available to super_admin without another data migration.
--
-- private.has_permission(): convenience wrapper for RLS policy expressions.
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
-- Tighten patients / patient_clinical_info / patient_files RLS: reads stay
-- available to any clinic staff (every seeded role has at least the
-- corresponding `.view` permission), but writes now also require the
-- matching permission on top of the existing clinic-tenancy check.
--
-- patients.delete specifically gates the soft-delete transition
-- (deleted_at going from null -> not null); patients.edit gates everything
-- else (including archive/restore, which only change `status`). This
-- mirrors the exact permission keys requested for Phase 2.1 without
-- introducing a separate "archive" permission that wasn't asked for.
-- ---------------------------------------------------------------------------
drop policy if exists "clinic staff can access their patients" on public.patients;

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
-- roles/permissions/role_permissions are readable by any authenticated staff
-- member (needed to render permission-aware UI and, later, a role picker),
-- but not writable through the API in this phase — there's no role
-- management UI yet, so writes stay migration-only/service-role-only.
-- ---------------------------------------------------------------------------
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;

create policy "authenticated can read roles"
  on public.roles for select
  to authenticated
  using (true);

create policy "authenticated can read permissions"
  on public.permissions for select
  to authenticated
  using (true);

create policy "authenticated can read role_permissions"
  on public.role_permissions for select
  to authenticated
  using (true);

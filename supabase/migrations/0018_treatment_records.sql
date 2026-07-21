-- Treatments / Procedures Management, Phase 2. Per the approved architecture
-- review: one new table, activating the clinical.view/clinical.edit
-- permissions that have existed unused since 0005_rbac.sql/0007_reapply_
-- rbac.sql. No changes to any existing table, trigger, RLS policy, or
-- function — visit_types already has a working "admins can manage visit
-- types" write policy (0008_appointments.sql), so the catalog-management
-- half of this milestone needs no migration at all.
--
-- One row per procedure actually performed at a visit (not one row per
-- appointment) — a visit can involve more than what was originally planned
-- on the appointment's own visit_type_id, and forcing 1:1 would misrepresent
-- real clinical work. clinic_id/patient_id/doctor_id are denormalized off
-- appointments for query convenience, the same tradeoff doctor_earnings
-- already makes relative to invoices/appointments.
--
-- Mutable (update, not append-only), unlike doctor_earnings — clinical notes
-- legitimately need correction (a typo, a missed detail) in a way settled
-- financial math doesn't. Every create/update is still audit-logged via the
-- existing writeAuditLog() helper, and there is no hard-delete policy for
-- authenticated — only a soft-delete via deleted_at through the same UPDATE
-- policy, matching appointments/patients' own soft-delete convention.
create table public.treatment_records (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  patient_id uuid not null references public.patients (id) on delete restrict,
  appointment_id uuid not null references public.appointments (id) on delete restrict,
  doctor_id uuid not null references public.staff_profiles (id) on delete restrict,
  visit_type_id uuid not null references public.visit_types (id) on delete restrict,
  notes text,
  created_by uuid references public.staff_profiles (id) on delete set null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index treatment_records_clinic_id_idx on public.treatment_records (clinic_id);
create index treatment_records_patient_id_idx on public.treatment_records (patient_id);
create index treatment_records_appointment_id_idx on public.treatment_records (appointment_id);

create trigger set_updated_at
  before update on public.treatment_records
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS. clinic tenancy + clinical.view/clinical.edit — the permission split
-- already granted since Phase 2.1 (dentist: view+edit, dental_assistant:
-- view only, viewer: view only, admin: both via the blanket grant). No
-- DELETE policy for authenticated: rows are only ever soft-deleted via
-- UPDATE, same as appointments/patients.
-- ---------------------------------------------------------------------------
alter table public.treatment_records enable row level security;

create policy "clinical staff can view treatment records"
  on public.treatment_records for select
  to authenticated
  using (
    (clinic_id = (select private.current_clinic_id()) or (select private.current_staff_role()) = 'super_admin')
    and (select private.has_permission('clinical.view'))
  );

create policy "clinical staff can create treatment records"
  on public.treatment_records for insert
  to authenticated
  with check (
    (clinic_id = (select private.current_clinic_id()) or (select private.current_staff_role()) = 'super_admin')
    and (select private.has_permission('clinical.edit'))
  );

create policy "clinical staff can update treatment records"
  on public.treatment_records for update
  to authenticated
  using (
    (clinic_id = (select private.current_clinic_id()) or (select private.current_staff_role()) = 'super_admin')
    and (select private.has_permission('clinical.edit'))
  )
  with check (
    (clinic_id = (select private.current_clinic_id()) or (select private.current_staff_role()) = 'super_admin')
    and (select private.has_permission('clinical.edit'))
  );

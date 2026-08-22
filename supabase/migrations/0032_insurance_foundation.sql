-- Insurance v1 foundation (commercial readiness batch).
--
-- Deliberately the smallest model that answers Phase 7's questions — who is
-- the insurer, what plan does the patient have, what is their membership
-- info, what does the plan cover — without building claims, payer
-- integrations, or adjudication. Not wired into Billing in this batch: the
-- existing invoices/invoice_items schema has no gross/insurer-covered/
-- patient-responsibility split, and inventing one under time pressure is
-- exactly the kind of "financial concept the current schema can't support
-- cleanly yet" Phase 9 says to avoid. coverage_percent below is stored and
-- pure-calculable (see src/lib/insurance/calculations.ts) for display
-- purposes only; it does not touch invoice math.
--
-- patients.insurance_provider / insurance_policy_number
-- (0001_phase1_foundation.sql) are untouched — free-text fields some clinics
-- may already have data in. This migration adds the structured alternative
-- alongside them rather than migrating or dropping existing data.

-- ---------------------------------------------------------------------------
-- insurers: "who is the insurer" — a clinic-scoped catalog, same category of
-- data as visit_types/price_lists.
-- ---------------------------------------------------------------------------
create table public.insurers (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint insurers_clinic_name_unique unique (clinic_id, name)
);

create index insurers_clinic_id_idx on public.insurers (clinic_id);

create trigger set_updated_at
  before update on public.insurers
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- insurance_plans: "what plan does the patient have" + "what coverage rules
-- apply". coverage_percent is the smallest useful coverage rule — a flat
-- percentage the plan covers of the charged price — not a rules engine.
-- ---------------------------------------------------------------------------
create table public.insurance_plans (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  insurer_id uuid not null references public.insurers (id) on delete cascade,
  name text not null,
  coverage_percent numeric(5, 2) not null default 100 check (coverage_percent >= 0 and coverage_percent <= 100),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint insurance_plans_insurer_name_unique unique (insurer_id, name)
);

create index insurance_plans_clinic_id_idx on public.insurance_plans (clinic_id);
create index insurance_plans_insurer_id_idx on public.insurance_plans (insurer_id);

create trigger set_updated_at
  before update on public.insurance_plans
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- patient_insurance: "what is the patient's membership/policy information" —
-- one row per patient (1:1, same shape as patient_clinical_info), not a
-- claims-ready multi-policy ledger. A clinic that later needs primary +
-- secondary coverage is a genuine future phase, not something this
-- foundation should guess the shape of today.
-- insurance_plan_id is `on delete set null` (not restrict/cascade): an
-- admin disabling or removing a plan later must never block that action or
-- silently delete a patient's membership record — it just loses the plan
-- link, same "historical/patient data outlives catalog changes" rule
-- invoice_items.visit_type_id already follows.
-- ---------------------------------------------------------------------------
create table public.patient_insurance (
  patient_id uuid primary key references public.patients (id) on delete cascade,
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  insurance_plan_id uuid references public.insurance_plans (id) on delete set null,
  member_id text,
  group_number text,
  notes text,
  updated_at timestamptz not null default now()
);

create index patient_insurance_clinic_id_idx on public.patient_insurance (clinic_id);
create index patient_insurance_insurance_plan_id_idx on public.patient_insurance (insurance_plan_id);

create trigger set_updated_at
  before update on public.patient_insurance
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS.
-- insurers/insurance_plans: mirrors visit_types/price_lists — clinic catalog,
-- admin-only writes.
-- patient_insurance: mirrors patient_clinical_info exactly (0001, refined by
-- 0007_reapply_rbac.sql) — reads open to clinic staff, writes gated by
-- patients.edit (it's patient data, not clinic configuration). No delete
-- policy, same as patient_clinical_info: insurance is cleared via UPDATE
-- (null out insurance_plan_id/member_id/group_number), never hard-deleted.
-- ---------------------------------------------------------------------------
alter table public.insurers enable row level security;
alter table public.insurance_plans enable row level security;
alter table public.patient_insurance enable row level security;

create policy "clinic staff can view insurers"
  on public.insurers for select
  to authenticated
  using (clinic_id = (select private.current_clinic_id()) or (select private.current_staff_role()) = 'super_admin');

create policy "admins can manage insurers"
  on public.insurers for all
  to authenticated
  using (
    (select private.current_staff_role()) = 'super_admin'
    or (clinic_id = (select private.current_clinic_id()) and (select private.current_staff_role()) = 'admin')
  )
  with check (
    (select private.current_staff_role()) = 'super_admin'
    or (clinic_id = (select private.current_clinic_id()) and (select private.current_staff_role()) = 'admin')
  );

create policy "clinic staff can view insurance plans"
  on public.insurance_plans for select
  to authenticated
  using (clinic_id = (select private.current_clinic_id()) or (select private.current_staff_role()) = 'super_admin');

create policy "admins can manage insurance plans"
  on public.insurance_plans for all
  to authenticated
  using (
    (select private.current_staff_role()) = 'super_admin'
    or (clinic_id = (select private.current_clinic_id()) and (select private.current_staff_role()) = 'admin')
  )
  with check (
    (select private.current_staff_role()) = 'super_admin'
    or (clinic_id = (select private.current_clinic_id()) and (select private.current_staff_role()) = 'admin')
  );

create policy "clinic staff can view patient insurance"
  on public.patient_insurance for select
  to authenticated
  using (clinic_id = (select private.current_clinic_id()) or (select private.current_staff_role()) = 'super_admin');

create policy "authorized staff can write patient insurance"
  on public.patient_insurance for insert
  to authenticated
  with check (
    (clinic_id = (select private.current_clinic_id()) or (select private.current_staff_role()) = 'super_admin')
    and (select private.has_permission('patients.edit'))
  );

create policy "authorized staff can update patient insurance"
  on public.patient_insurance for update
  to authenticated
  using (clinic_id = (select private.current_clinic_id()) or (select private.current_staff_role()) = 'super_admin')
  with check (
    (clinic_id = (select private.current_clinic_id()) or (select private.current_staff_role()) = 'super_admin')
    and (select private.has_permission('patients.edit'))
  );

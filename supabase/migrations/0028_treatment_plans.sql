create table public.treatment_plans (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  patient_id uuid not null references public.patients (id) on delete cascade,
  created_by uuid references public.staff_profiles (id) on delete set null,
  title text,
  status text not null default 'draft' check (status in ('draft', 'active', 'completed', 'abandoned')),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index treatment_plans_clinic_id_idx on public.treatment_plans (clinic_id);
create index treatment_plans_patient_id_idx on public.treatment_plans (patient_id);

create trigger set_updated_at
  before update on public.treatment_plans
  for each row execute function public.set_updated_at();

create table public.treatment_plan_items (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  treatment_plan_id uuid not null references public.treatment_plans (id) on delete cascade,
  visit_type_id uuid references public.visit_types (id) on delete set null,
  procedure_name text not null,
  estimated_price numeric(10, 2) not null check (estimated_price >= 0),
  quantity numeric(10, 2) not null default 1 check (quantity > 0),
  tooth_reference text,
  sequence integer not null,
  priority text not null default 'normal' check (priority in ('normal', 'high', 'urgent')),
  status text not null default 'planned'
    check (status in ('planned', 'accepted', 'postponed', 'rejected', 'in_progress', 'completed')),
  decided_at timestamptz,
  notes text,
  appointment_id uuid references public.appointments (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index treatment_plan_items_treatment_plan_id_idx on public.treatment_plan_items (treatment_plan_id);
create index treatment_plan_items_clinic_id_idx on public.treatment_plan_items (clinic_id);
create index treatment_plan_items_appointment_id_idx on public.treatment_plan_items (appointment_id);

create trigger set_updated_at
  before update on public.treatment_plan_items
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Treatment Records linkage. Nullable, on delete set null, on purpose — a
-- treatment_records row must keep working exactly as it does today whether
-- or not it fulfills a planned item, and a treatment plan item being deleted
-- later must never retroactively block that delete or corrupt a historical
-- treatment record. Direction is deliberate: the "fact" table
-- (treatment_records) points back to the "intent" table
-- (treatment_plan_items), the same direction invoice_items.visit_type_id
-- points from the concrete row back to its catalog reference
-- (0023_invoice_items_visit_type.sql). No column is added to
-- treatment_plan_items for this relationship.
--
-- No RLS change: treatment_records' existing "clinical staff can
-- view/create/update treatment records" policies (0018_treatment_records.sql)
-- are column-agnostic (clinical.view/clinical.edit + clinic tenancy) and
-- already cover this new column.
-- ---------------------------------------------------------------------------

alter table public.treatment_records
  add column treatment_plan_item_id uuid references public.treatment_plan_items (id) on delete set null;

create index treatment_records_treatment_plan_item_id_idx on public.treatment_records (treatment_plan_item_id);

-- ---------------------------------------------------------------------------
-- RLS. Mirrors patient_clinical_notes/treatment_records exactly for the
-- treatment_plans parent (select/insert/update, no delete — soft-delete via
-- UPDATE only). treatment_plan_items gets a single "for all" policy
-- including a genuine DELETE, the same shape invoice_items uses
-- (0011_billing.sql's "authorized staff can manage invoice items") — the
-- app-layer rule restricting item deletion to draft-status plans lives in
-- application code, not RLS, per the approved design.
-- ---------------------------------------------------------------------------

alter table public.treatment_plans enable row level security;
alter table public.treatment_plan_items enable row level security;

create policy "clinical staff can view treatment plans"
  on public.treatment_plans for select
  to authenticated
  using (
    (clinic_id = (select private.current_clinic_id()) or (select private.current_staff_role()) = 'super_admin')
    and (select private.has_permission('clinical.view'))
  );

create policy "clinical staff can create treatment plans"
  on public.treatment_plans for insert
  to authenticated
  with check (
    (clinic_id = (select private.current_clinic_id()) or (select private.current_staff_role()) = 'super_admin')
    and (select private.has_permission('clinical.edit'))
  );

create policy "clinical staff can update treatment plans"
  on public.treatment_plans for update
  to authenticated
  using (
    (clinic_id = (select private.current_clinic_id()) or (select private.current_staff_role()) = 'super_admin')
    and (select private.has_permission('clinical.edit'))
  )
  with check (
    (clinic_id = (select private.current_clinic_id()) or (select private.current_staff_role()) = 'super_admin')
    and (select private.has_permission('clinical.edit'))
  );

create policy "clinical staff can view treatment plan items"
  on public.treatment_plan_items for select
  to authenticated
  using (
    (clinic_id = (select private.current_clinic_id()) or (select private.current_staff_role()) = 'super_admin')
    and (select private.has_permission('clinical.view'))
  );

create policy "clinical staff can manage treatment plan items"
  on public.treatment_plan_items for all
  to authenticated
  using (
    (clinic_id = (select private.current_clinic_id()) or (select private.current_staff_role()) = 'super_admin')
    and (select private.has_permission('clinical.edit'))
  )
  with check (
    (clinic_id = (select private.current_clinic_id()) or (select private.current_staff_role()) = 'super_admin')
    and (select private.has_permission('clinical.edit'))
  );

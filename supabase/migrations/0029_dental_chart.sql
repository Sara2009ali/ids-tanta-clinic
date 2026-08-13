-- Dental Chart, v1. Per the approved architecture: the chart is a spatial
-- index across existing clinical modules, not a new clinical silo. Planned
-- and performed treatment stay fully owned by treatment_plans/
-- treatment_plan_items and treatment_records — this migration only adds a
-- nullable tooth_id to each so the chart can join into them, plus the two
-- tables that hold what nothing else already answers: a tooth's current
-- state, and its append-only clinical event history.
--
-- teeth is global reference data (like roles/permissions/role_permissions),
-- not clinic-scoped: anatomy doesn't vary by clinic. FDI (ISO 3950) is the
-- sole stored numbering system — dentition/arch/quadrant/position are
-- generated columns derived from fdi_number alone, the same technique
-- patients.full_name already uses, so they can never drift from the number
-- they're keyed on. Universal/Palmer are display-only conversions computed
-- in application code (src/lib/dental-chart/calculations.ts); they are never
-- stored.
--
-- patient_tooth_state is a current-state snapshot, one row per tooth that
-- has ever been touched for a patient (lazily created, not pre-seeded), kept
-- current by upsert on (patient_id, fdi_number) — the same one-row-per-
-- parent upsert pattern patient_clinical_info already uses. It is corrected
-- by update, not delete, so it carries no deleted_at, matching treatment_
-- plans' own no-delete-policy shape.
--
-- patient_tooth_events is genuinely append-only clinical history — no
-- update, no delete policy at all, stricter than every other table in this
-- schema. A mistaken entry is corrected by recording a new event, never by
-- editing history. This is deliberately separate from audit_log: audit_log
-- answers "who technically changed this row, for compliance" (and still
-- fires on every write here via the existing writeAuditLog() helper);
-- patient_tooth_events answers "what clinically happened to this tooth," in
-- clinical language. Two event types only in v1 — observation (a note that
-- doesn't itself change stored state) and state_changed (fired whenever a
-- dentist explicitly edits patient_tooth_state through the Tooth Sheet) — no
-- generic event taxonomy. Every event is staff-initiated; nothing in this
-- migration or the application code it backs infers/classifies a tooth's
-- condition automatically from a treatment record or procedure name — that
-- would be automated clinical classification, which the approved v1 scope
-- explicitly excludes. treatment_records.tooth_id (below) is a display/
-- linkage concern only and never triggers a chart write.
--
-- No surfaces column in v1 (patient_tooth_state or elsewhere) — whole-tooth
-- granularity is the entire v1 scope, per the approved architecture; a
-- surface model is deferred to a future module rather than spoken for here.
--
-- treatment_plan_items.tooth_id and treatment_records.tooth_id are both
-- nullable, on delete set null, pointing at teeth — the same "fact/intent
-- table points outward at its reference" direction already established by
-- treatment_records.treatment_plan_item_id (0028_treatment_plans.sql) and
-- invoice_items.visit_type_id (0023_invoice_items_visit_type.sql). Neither
-- column replaces treatment_plan_items.tooth_reference, which remains
-- permanently supported, untouched, and un-migrated — it is the only honest
-- representation for multi-tooth, quadrant, or full-mouth references
-- ("Teeth 11, 21", "Upper right quadrant", "Full mouth") that a single
-- tooth_id cannot express. No existing row's tooth_reference is parsed or
-- backfilled by this migration. No junction table is introduced for
-- multi-tooth structure in v1 — role_permissions remains the template if
-- that's ever needed.
--
-- No RLS change on treatment_plan_items/treatment_records: both tables'
-- existing select/insert/update policies are column-agnostic (clinic
-- tenancy + clinical.view/clinical.edit) and already cover these new
-- columns, the same reasoning 0028_treatment_plans.sql used when it added
-- treatment_plan_item_id.

-- ---------------------------------------------------------------------------
-- teeth: global FDI reference, 52 rows, seeded below. Not clinic-scoped.
-- ---------------------------------------------------------------------------
create table public.teeth (
  fdi_number smallint primary key,
  dentition text generated always as (
    case when (fdi_number / 10) between 1 and 4 then 'permanent' else 'primary' end
  ) stored,
  arch text generated always as (
    case when (fdi_number / 10) in (1, 2, 5, 6) then 'upper' else 'lower' end
  ) stored,
  quadrant smallint generated always as (fdi_number / 10) stored,
  tooth_position smallint generated always as (fdi_number % 10) stored,
  created_at timestamptz not null default now(),
  constraint teeth_fdi_number_range check (fdi_number between 11 and 85 and (fdi_number % 10) between 1 and 8)
);

-- Quadrants 1-4 x positions 1-8 = 32 permanent teeth (11-18/21-28/31-38/41-48).
-- Quadrants 5-8 x positions 1-5 = 20 primary teeth (51-55/61-65/71-75/81-85) —
-- five per quadrant, not eight; primary dentition is not "just another
-- numbering range" (central incisor through second molar only, no
-- premolars/third molar).
insert into public.teeth (fdi_number)
select quadrant * 10 + position
from generate_series(1, 4) as quadrant, generate_series(1, 8) as position
union all
select quadrant * 10 + position
from generate_series(5, 8) as quadrant, generate_series(1, 5) as position
order by 1;

alter table public.teeth enable row level security;

create policy "authenticated can read teeth"
  on public.teeth for select
  to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- patient_tooth_state: current state, one row per patient x tooth.
-- ---------------------------------------------------------------------------
create table public.patient_tooth_state (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  patient_id uuid not null references public.patients (id) on delete cascade,
  fdi_number smallint not null references public.teeth (fdi_number) on delete restrict,
  status text not null default 'present' check (status in ('present', 'missing', 'unerupted')),
  condition text check (condition in ('caries', 'filling', 'crown', 'root_canal', 'watch', 'other')),
  notes text,
  updated_by uuid references public.staff_profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint patient_tooth_state_patient_tooth_unique unique (patient_id, fdi_number)
);

create index patient_tooth_state_clinic_id_idx on public.patient_tooth_state (clinic_id);

create trigger set_updated_at
  before update on public.patient_tooth_state
  for each row execute function public.set_updated_at();

alter table public.patient_tooth_state enable row level security;

create policy "clinical staff can view tooth state"
  on public.patient_tooth_state for select
  to authenticated
  using (
    (clinic_id = (select private.current_clinic_id()) or (select private.current_staff_role()) = 'super_admin')
    and (select private.has_permission('clinical.view'))
  );

create policy "clinical staff can create tooth state"
  on public.patient_tooth_state for insert
  to authenticated
  with check (
    (clinic_id = (select private.current_clinic_id()) or (select private.current_staff_role()) = 'super_admin')
    and (select private.has_permission('clinical.edit'))
  );

create policy "clinical staff can update tooth state"
  on public.patient_tooth_state for update
  to authenticated
  using (
    (clinic_id = (select private.current_clinic_id()) or (select private.current_staff_role()) = 'super_admin')
    and (select private.has_permission('clinical.edit'))
  )
  with check (
    (clinic_id = (select private.current_clinic_id()) or (select private.current_staff_role()) = 'super_admin')
    and (select private.has_permission('clinical.edit'))
  );

-- ---------------------------------------------------------------------------
-- patient_tooth_events: append-only clinical history. No update/delete
-- policy at all, intentionally — see header comment.
-- ---------------------------------------------------------------------------
create table public.patient_tooth_events (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  patient_id uuid not null references public.patients (id) on delete cascade,
  fdi_number smallint not null references public.teeth (fdi_number) on delete restrict,
  event_type text not null check (event_type in ('observation', 'state_changed')),
  previous_status text check (previous_status in ('present', 'missing', 'unerupted')),
  previous_condition text check (previous_condition in ('caries', 'filling', 'crown', 'root_canal', 'watch', 'other')),
  status text check (status in ('present', 'missing', 'unerupted')),
  condition text check (condition in ('caries', 'filling', 'crown', 'root_canal', 'watch', 'other')),
  appointment_id uuid references public.appointments (id) on delete set null,
  notes text,
  recorded_by uuid references public.staff_profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index patient_tooth_events_clinic_id_idx on public.patient_tooth_events (clinic_id);
create index patient_tooth_events_patient_tooth_idx
  on public.patient_tooth_events (patient_id, fdi_number, created_at desc);

alter table public.patient_tooth_events enable row level security;

create policy "clinical staff can view tooth events"
  on public.patient_tooth_events for select
  to authenticated
  using (
    (clinic_id = (select private.current_clinic_id()) or (select private.current_staff_role()) = 'super_admin')
    and (select private.has_permission('clinical.view'))
  );

create policy "clinical staff can create tooth events"
  on public.patient_tooth_events for insert
  to authenticated
  with check (
    (clinic_id = (select private.current_clinic_id()) or (select private.current_staff_role()) = 'super_admin')
    and (select private.has_permission('clinical.edit'))
  );

-- ---------------------------------------------------------------------------
-- Structured tooth linkage on existing clinical tables. Additive, nullable,
-- no backfill. tooth_reference is untouched — see header comment.
-- ---------------------------------------------------------------------------
alter table public.treatment_plan_items
  add column tooth_id smallint references public.teeth (fdi_number) on delete set null;

create index treatment_plan_items_tooth_id_idx on public.treatment_plan_items (tooth_id);

alter table public.treatment_records
  add column tooth_id smallint references public.teeth (fdi_number) on delete set null;

create index treatment_records_tooth_id_idx on public.treatment_records (tooth_id);

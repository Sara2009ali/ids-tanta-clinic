-- Recalls, Version 1.
--
-- A recall is a clinical follow-up obligation — "this patient needs to be
-- seen again, for this reason, by this date" — independent of whether a
-- visit is currently booked. It is deliberately its own table, not a new
-- column on any existing one: it isn't a treatment_plan_item (no plan
-- required), isn't a treatment_record (nothing has happened yet), and isn't
-- an appointment (no visit is necessarily booked). One new, self-contained
-- table, reusing every existing convention rather than inventing one:
-- clinic-scoped RLS via private.current_clinic_id()/current_staff_role()
-- (0001), the shared set_updated_at() trigger (0001), and the exact
-- clinical.view/clinical.edit-gated RLS shape treatment_plans/
-- treatment_plan_items already use (0028) — a recall is the same category
-- of clinical-intent record they are, not administrative/business data.
--
-- appointment_id/visit_type_id/doctor_id are all nullable, single-purpose
-- pointers (on delete set null), the same shape treatment_plan_items
-- already uses for its own optional appointment_id/visit_type_id — never a
-- required relationship, never a second scheduling system. There is no
-- treatment_plan_id/treatment_plan_item_id/treatment_record_id column:
-- nothing in the approved design connects a recall back to the plan or
-- record it may have arisen from, so no such FK is added.
--
-- due_date is an explicit column, never derived from patients.last_visit_at
-- (which no application code maintains) and never computed from a stored
-- interval — the approved design deliberately avoids inventing a dental
-- recall-interval concept this product has no evidence for.
--
-- "Overdue" is intentionally not a status value: status stays a 4-state
-- workflow vocabulary (due/scheduled/completed/dismissed), and overdue is
-- derived at read time from status = 'due' and due_date in the past (see
-- src/lib/recalls/calculations.ts) — the same "derive, don't store" instinct
-- appointment_status_history/doctor_earnings already apply elsewhere.
create table public.recalls (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  -- Cascade, not restrict: a recall is an "intent" record like a treatment
  -- plan (0028, also cascade), not an immutable historical "fact" like a
  -- treatment record (0018, restrict) — it has no continued purpose once
  -- the patient it belongs to is gone.
  patient_id uuid not null references public.patients (id) on delete cascade,
  -- Optional — a recall isn't always doctor-specific ("see any dentist in 6 months").
  doctor_id uuid references public.staff_profiles (id) on delete set null,
  -- Optional catalog tag, same shape as treatment_plan_items.visit_type_id.
  visit_type_id uuid references public.visit_types (id) on delete set null,
  -- Optional pointer to the appointment expected/used to fulfill this
  -- recall. Never synced automatically from appointment status changes —
  -- see the deliberate absence of any trigger on public.appointments below.
  appointment_id uuid references public.appointments (id) on delete set null,
  reason text not null,
  due_date date not null,
  status text not null default 'due' check (status in ('due', 'scheduled', 'completed', 'dismissed')),
  -- Set by the application when status first leaves 'due'. Mirrors
  -- treatment_plan_items.decided_at exactly (0028) — one "when was this
  -- decided" timestamp, not a separate *_at column per status.
  decided_at timestamptz,
  notes text,
  -- Only meaningful once status = 'dismissed'; application code clears it
  -- on any other status change (see changeRecallStatus()).
  dismissed_reason text,
  created_by uuid references public.staff_profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index recalls_clinic_id_idx on public.recalls (clinic_id);
create index recalls_patient_id_idx on public.recalls (patient_id);
-- Powers the worklist's primary sort: due items, soonest due date first.
create index recalls_status_due_date_idx on public.recalls (status, due_date);
create index recalls_doctor_id_idx on public.recalls (doctor_id);
create index recalls_appointment_id_idx on public.recalls (appointment_id);

create trigger set_updated_at
  before update on public.recalls
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS. Identical shape to treatment_plans/treatment_plan_items (0028):
-- clinic tenancy + clinical.view for reads, clinic tenancy + clinical.edit
-- for every write, including delete. The "only while status = 'due'" delete
-- restriction is deliberately not encoded here — it's an application-layer
-- rule (see deleteRecall()), the same division of labor
-- treatment_plan_items' "only while the plan is draft" delete rule already
-- uses.
-- ---------------------------------------------------------------------------
alter table public.recalls enable row level security;

create policy "clinical staff can view recalls"
  on public.recalls for select
  to authenticated
  using (
    (clinic_id = (select private.current_clinic_id()) or (select private.current_staff_role()) = 'super_admin')
    and (select private.has_permission('clinical.view'))
  );

create policy "clinical staff can create recalls"
  on public.recalls for insert
  to authenticated
  with check (
    (clinic_id = (select private.current_clinic_id()) or (select private.current_staff_role()) = 'super_admin')
    and (select private.has_permission('clinical.edit'))
  );

create policy "clinical staff can update recalls"
  on public.recalls for update
  to authenticated
  using (
    (clinic_id = (select private.current_clinic_id()) or (select private.current_staff_role()) = 'super_admin')
    and (select private.has_permission('clinical.edit'))
  )
  with check (
    (clinic_id = (select private.current_clinic_id()) or (select private.current_staff_role()) = 'super_admin')
    and (select private.has_permission('clinical.edit'))
  );

create policy "clinical staff can delete recalls"
  on public.recalls for delete
  to authenticated
  using (
    (clinic_id = (select private.current_clinic_id()) or (select private.current_staff_role()) = 'super_admin')
    and (select private.has_permission('clinical.edit'))
  );

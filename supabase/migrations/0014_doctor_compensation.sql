-- Doctor Compensation, Phase 2 (Schema + Read Layer). Per the approved
-- architecture: three new, self-contained tables (zero changes to any
-- existing table's columns/constraints), a trigger-based sync mechanism on
-- payments (the sole synchronization path — no scheduled job exists
-- anywhere in this codebase, and none is introduced here), effective-dated
-- append-only compensation rules, a snapshot-immutable earnings ledger, and
-- a new "doctor sees their own rows" RLS shape (the first in this schema
-- not expressible purely as clinic-tenancy + permission key).
--
-- Idempotency: the same financial event (a payments row) can never produce
-- duplicate doctor_earnings rows. Enforced by `unique (payment_id,
-- entry_type)` on doctor_earnings, not just application logic — a payment
-- row already is Billing's own canonical unique identifier of "one
-- financial event" (payments.id), so this reuses that existing business
-- key directly rather than inventing a synthetic idempotency token. Every
-- insert the trigger performs uses `on conflict (payment_id, entry_type) do
-- nothing`, so retries, trigger re-execution, or concurrent transactions on
-- the same payment can never create a second row for the same event — the
-- constraint makes it structurally impossible, not just unlikely.

-- ---------------------------------------------------------------------------
-- New permission keys. Additive catalog rows only — the RBAC mechanism
-- itself (roles/permissions/role_permissions, current_permissions(),
-- has_permission()) is unchanged, used exactly as designed for a new
-- module, the same way appointments.*/billing.* were added previously.
--
-- Grants: super_admin gets every permission automatically (current_
-- permissions()'s union-with-the-whole-table case, no row needed here).
-- admin and accountant get both keys explicitly, mirroring exactly how
-- accountant already holds full billing.* — doctor compensation is a
-- finance/HR concern, not a front-desk one, so reception_manager (which
-- holds billing.view but not billing.edit) is deliberately NOT granted
-- either key. dentist is deliberately granted neither key either: a
-- doctor's visibility into their OWN compensation comes entirely from the
-- doctor_id = auth.uid() RLS clause below, not from compensation.view —
-- exactly the design point clarified before this phase began.
-- ---------------------------------------------------------------------------
insert into public.permissions (key, label) values
  ('compensation.view', 'View doctor compensation'),
  ('compensation.manage', 'Manage compensation rules and settlements')
on conflict (key) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.key = 'admin' and p.key in ('compensation.view', 'compensation.manage')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.key = 'accountant' and p.key in ('compensation.view', 'compensation.manage')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- compensation_rules: doctor_id null = clinic-wide default for that
-- procedure; visit_type_id null = that doctor's default across every
-- procedure. Effective-dated and treated as append-only by convention
-- (Phase 3's rule-management action will only ever close effective_to and
-- insert a new row — never update an existing row's type/config — the same
-- way invoice_items are only ever fully replaced, not partially patched, on
-- the draft-only edit path). visit_type_id reuses the existing procedure
-- catalog (0008_appointments.sql) directly rather than duplicating it.
-- ---------------------------------------------------------------------------
create table public.compensation_rules (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  doctor_id uuid references public.staff_profiles (id) on delete restrict,
  visit_type_id uuid references public.visit_types (id) on delete restrict,
  type text not null check (type in ('percentage', 'fixed', 'hybrid')),
  config jsonb not null,
  effective_from date not null default current_date,
  effective_to date,
  created_by uuid references public.staff_profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint compensation_rules_effective_range check (effective_to is null or effective_to > effective_from)
);

create index compensation_rules_clinic_id_idx on public.compensation_rules (clinic_id);
create index compensation_rules_doctor_visit_type_idx on public.compensation_rules (clinic_id, doctor_id, visit_type_id);

create trigger set_updated_at
  before update on public.compensation_rules
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- doctor_settlements: a permanent, immutable per-doctor per-period
-- statement. Deliberately no update/delete RLS policy at all (see below) —
-- "settled never changes" is enforced at the database layer, not just by
-- convention. `status` is single-valued today ('settled') because Phase 2
-- creates no rows here at all (no settlement action exists yet); the column
-- exists now so Phase 3 doesn't need a schema change to introduce a
-- genuine draft/open workflow later if needed.
-- ---------------------------------------------------------------------------
create table public.doctor_settlements (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  doctor_id uuid not null references public.staff_profiles (id) on delete restrict,
  period_start date not null,
  period_end date not null,
  status text not null default 'settled' check (status in ('settled')),
  total_amount numeric(10, 2) not null,
  settled_by uuid references public.staff_profiles (id) on delete set null,
  settled_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint doctor_settlements_period_range check (period_end > period_start),
  constraint doctor_settlements_unique_period unique (clinic_id, doctor_id, period_start, period_end)
);

create index doctor_settlements_clinic_doctor_idx on public.doctor_settlements (clinic_id, doctor_id);

-- ---------------------------------------------------------------------------
-- doctor_earnings: the ledger. Insert-only in practice — the only "update"
-- this schema permits at all is the trigger's own voided_at soft-void of an
-- unsettled entry (mirroring payments.deleted_at); there is no RLS
-- insert/update/delete policy for authenticated users (see below), the
-- same "written exclusively by a trigger, never by application code" shape
-- appointment_status_history already established in 0008.
--
-- amount is stored SIGNED (negative for reversal/correction), unlike
-- payments.amount (always positive, sign encoded via `type`). That choice
-- on payments was specifically to protect several pre-existing
-- sum(amount) call sites across the app from a sign-error bug. This is a
-- brand-new ledger with no pre-existing call sites to protect, and its
-- entire purpose is settlement aggregation — a plain sum(amount) over
-- pending rows must equal net pending earnings with no CASE required. This
-- is a deliberate, justified divergence from the payments convention, not
-- an inconsistency with it.
-- ---------------------------------------------------------------------------
create table public.doctor_earnings (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  doctor_id uuid not null references public.staff_profiles (id) on delete restrict,
  invoice_id uuid not null references public.invoices (id) on delete restrict,
  payment_id uuid not null references public.payments (id) on delete restrict,
  compensation_rule_id uuid references public.compensation_rules (id) on delete restrict,
  entry_type text not null check (entry_type in ('earning', 'reversal', 'correction', 'unresolved')),
  amount numeric(10, 2) not null default 0,
  rate_snapshot jsonb,
  settlement_id uuid references public.doctor_settlements (id) on delete restrict,
  voided_at timestamptz,
  created_at timestamptz not null default now(),
  constraint doctor_earnings_payment_entry_type_unique unique (payment_id, entry_type)
);

create index doctor_earnings_clinic_doctor_idx on public.doctor_earnings (clinic_id, doctor_id);
create index doctor_earnings_clinic_doctor_settlement_idx on public.doctor_earnings (clinic_id, doctor_id, settlement_id);
create index doctor_earnings_invoice_id_idx on public.doctor_earnings (invoice_id);

-- ---------------------------------------------------------------------------
-- compute_full_compensation: "compensation owed if this invoice is paid in
-- full," for a given rule. Every rule type resolves to one number here —
-- the mechanism that lets proration (in the trigger below) handle partial
-- payments identically regardless of which model produced the number. This
-- function is mirrored line-for-line in src/lib/compensation/calculations.ts
-- for live UI preview/testing, the same relationship
-- src/lib/billing/calculations.ts already has to recalculate_invoice_totals().
-- ---------------------------------------------------------------------------
create or replace function public.compute_full_compensation(p_type text, p_config jsonb, p_subtotal numeric)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select case p_type
    when 'percentage' then round(p_subtotal * coalesce((p_config->>'rate')::numeric, 0) / 100, 2)
    when 'fixed' then round(coalesce((p_config->>'amount')::numeric, 0), 2)
    when 'hybrid' then round(
      coalesce((p_config->>'base_amount')::numeric, 0)
      + p_subtotal * coalesce((p_config->>'rate')::numeric, 0) / 100,
      2
    )
    else 0
  end;
$$;

-- ---------------------------------------------------------------------------
-- sync_doctor_compensation: the sole synchronization mechanism between
-- Billing and Doctor Compensation. Fires on every payments insert (a new
-- payment or refund) and on the one-time deleted_at null -> non-null
-- transition (a void). No Billing table, column, constraint, or existing
-- trigger is modified — this is a second, independent trigger on an
-- existing table, the same non-invasive technique already used twice in
-- this schema (recalculate_invoice_totals_on_payments, log_appointment_
-- status_change), applied a third time. Billing's Server Actions remain
-- completely unaware this trigger exists.
-- ---------------------------------------------------------------------------
create or replace function public.sync_doctor_compensation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invoice_appointment_id uuid;
  v_invoice_subtotal numeric(10, 2);
  v_invoice_clinic_id uuid;
  v_doctor_id uuid;
  v_visit_type_id uuid;
  v_rule_id uuid;
  v_rule_type text;
  v_rule_config jsonb;
  v_full_compensation numeric(10, 2);
  v_amount numeric(10, 2);
  v_entry_type text;
  v_existing_id uuid;
  v_existing_clinic_id uuid;
  v_existing_doctor_id uuid;
  v_existing_invoice_id uuid;
  v_existing_rule_id uuid;
  v_existing_amount numeric(10, 2);
  v_existing_rate_snapshot jsonb;
  v_existing_settlement_id uuid;
begin
  if tg_op = 'INSERT' then
    if new.deleted_at is not null then
      return new;
    end if;

    select i.appointment_id, i.subtotal, i.clinic_id
      into v_invoice_appointment_id, v_invoice_subtotal, v_invoice_clinic_id
      from public.invoices i
      where i.id = new.invoice_id;

    if v_invoice_appointment_id is null then
      -- No linked appointment: no doctor to attribute to. Deliberately not
      -- an 'unresolved' case (that's reserved for "doctor known, rule
      -- missing") — this is out of Phase 1's approved functional scope
      -- entirely, not a configuration gap to flag.
      return new;
    end if;

    select a.doctor_id, a.visit_type_id
      into v_doctor_id, v_visit_type_id
      from public.appointments a
      where a.id = v_invoice_appointment_id;

    select cr.id, cr.type, cr.config
      into v_rule_id, v_rule_type, v_rule_config
      from public.compensation_rules cr
      where cr.clinic_id = v_invoice_clinic_id
        and (cr.doctor_id = v_doctor_id or cr.doctor_id is null)
        and (cr.visit_type_id = v_visit_type_id or cr.visit_type_id is null)
        and cr.effective_from <= new.paid_at::date
        and (cr.effective_to is null or cr.effective_to > new.paid_at::date)
      order by
        (cr.doctor_id is not null) desc,
        (cr.visit_type_id is not null) desc,
        cr.effective_from desc
      limit 1;

    v_entry_type := case when new.type = 'refund' then 'reversal' else 'earning' end;

    if v_rule_id is null then
      insert into public.doctor_earnings (
        clinic_id, doctor_id, invoice_id, payment_id, compensation_rule_id, entry_type, amount, rate_snapshot
      ) values (
        v_invoice_clinic_id, v_doctor_id, new.invoice_id, new.id, null, 'unresolved', 0, null
      )
      on conflict (payment_id, entry_type) do nothing;

      insert into public.audit_log (clinic_id, actor_id, action, entity_type, entity_id, changes)
      values (
        v_invoice_clinic_id, new.created_by, 'compensation.rule_missing', 'payment', new.id,
        jsonb_build_object('invoice_id', new.invoice_id, 'doctor_id', v_doctor_id, 'visit_type_id', v_visit_type_id)
      );

      return new;
    end if;

    v_full_compensation := public.compute_full_compensation(v_rule_type, v_rule_config, v_invoice_subtotal);
    v_amount := round(coalesce(new.amount * (v_full_compensation / nullif(v_invoice_subtotal, 0)), 0), 2);
    if new.type = 'refund' then
      v_amount := -v_amount;
    end if;

    insert into public.doctor_earnings (
      clinic_id, doctor_id, invoice_id, payment_id, compensation_rule_id, entry_type, amount, rate_snapshot
    ) values (
      v_invoice_clinic_id, v_doctor_id, new.invoice_id, new.id, v_rule_id, v_entry_type, v_amount,
      jsonb_build_object(
        'rule_type', v_rule_type,
        'rule_config', v_rule_config,
        'invoice_subtotal', v_invoice_subtotal,
        'payment_amount', new.amount,
        'computed_amount', v_amount
      )
    )
    on conflict (payment_id, entry_type) do nothing;

    return new;
  end if;

  if tg_op = 'UPDATE' and new.deleted_at is not null and old.deleted_at is null then
    select id, clinic_id, doctor_id, invoice_id, compensation_rule_id, amount, rate_snapshot, settlement_id
      into v_existing_id, v_existing_clinic_id, v_existing_doctor_id, v_existing_invoice_id,
        v_existing_rule_id, v_existing_amount, v_existing_rate_snapshot, v_existing_settlement_id
      from public.doctor_earnings
      where payment_id = new.id and entry_type in ('earning', 'reversal')
      limit 1;

    if v_existing_id is null then
      -- Nothing to reverse: the original payment was either 'unresolved'
      -- (no rule existed, nothing was ever earned) or had no linked
      -- appointment at all.
      return new;
    end if;

    if v_existing_settlement_id is null then
      update public.doctor_earnings set voided_at = now() where id = v_existing_id;
    else
      insert into public.doctor_earnings (
        clinic_id, doctor_id, invoice_id, payment_id, compensation_rule_id, entry_type, amount, rate_snapshot
      ) values (
        v_existing_clinic_id, v_existing_doctor_id, v_existing_invoice_id, new.id, v_existing_rule_id,
        'correction', -v_existing_amount, v_existing_rate_snapshot
      )
      on conflict (payment_id, entry_type) do nothing;
    end if;

    return new;
  end if;

  return new;
end;
$$;

create trigger sync_doctor_compensation
  after insert or update on public.payments
  for each row execute function public.sync_doctor_compensation();

-- ---------------------------------------------------------------------------
-- RLS. New shape: clinic tenancy AND (own row OR permission key) — the
-- first policy in this schema not expressible purely as tenancy+permission,
-- justified by the explicit requirement that a doctor see their own
-- compensation without needing compensation.view (that key is for
-- accountant/admin visibility into every doctor's data).
-- ---------------------------------------------------------------------------
alter table public.compensation_rules enable row level security;
alter table public.doctor_earnings enable row level security;
alter table public.doctor_settlements enable row level security;

create policy "relevant staff can view compensation rules"
  on public.compensation_rules for select
  to authenticated
  using (
    (clinic_id = (select private.current_clinic_id()) or (select private.current_staff_role()) = 'super_admin')
    and (
      doctor_id = (select auth.uid())
      or doctor_id is null
      or (select private.has_permission('compensation.view'))
    )
  );

create policy "authorized staff can create compensation rules"
  on public.compensation_rules for insert
  to authenticated
  with check (
    (clinic_id = (select private.current_clinic_id()) or (select private.current_staff_role()) = 'super_admin')
    and (select private.has_permission('compensation.manage'))
  );

create policy "authorized staff can update compensation rules"
  on public.compensation_rules for update
  to authenticated
  using (clinic_id = (select private.current_clinic_id()) or (select private.current_staff_role()) = 'super_admin')
  with check (
    (clinic_id = (select private.current_clinic_id()) or (select private.current_staff_role()) = 'super_admin')
    and (select private.has_permission('compensation.manage'))
  );

create policy "authorized staff can delete compensation rules"
  on public.compensation_rules for delete
  to authenticated
  using (
    (clinic_id = (select private.current_clinic_id()) or (select private.current_staff_role()) = 'super_admin')
    and (select private.has_permission('compensation.manage'))
  );

-- doctor_earnings: select-only, on purpose — see the table comment above.
create policy "doctors view their own earnings, authorized staff view all"
  on public.doctor_earnings for select
  to authenticated
  using (
    (clinic_id = (select private.current_clinic_id()) or (select private.current_staff_role()) = 'super_admin')
    and (doctor_id = (select auth.uid()) or (select private.has_permission('compensation.view')))
  );

-- doctor_settlements: select-only in Phase 2 — no write policy exists yet
-- because nothing writes to this table yet (no settlement action has been
-- built). Phase 3's settlement action is expected to go through a
-- SECURITY DEFINER function (mirroring assign_invoice_number()/
-- recalculate_invoice_totals()), not a direct insert/update policy against
-- this table, so that "a settled statement never changes" stays a database
-- fact even once writes exist, not just an application convention.
create policy "doctors view their own settlements, authorized staff view all"
  on public.doctor_settlements for select
  to authenticated
  using (
    (clinic_id = (select private.current_clinic_id()) or (select private.current_staff_role()) = 'super_admin')
    and (doctor_id = (select auth.uid()) or (select private.has_permission('compensation.view')))
  );

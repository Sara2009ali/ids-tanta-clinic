-- Phase 3B, Billing Module (Version 1).
--
-- Reuses established conventions throughout: clinic-scoped RLS via
-- private.current_clinic_id()/current_staff_role() (0001), the shared
-- set_updated_at() trigger (0001), permission-gated writes via
-- private.has_permission() (0005/0007) — the appointments RLS shape, not
-- the admin-only "manage X" shape used for chairs/doctor schedules, since
-- billing.view/billing.edit are already granted to non-admin roles
-- (accountant, reception_manager) in 0007_reapply_rbac.sql. A
-- check-constraint status column (text + check), matching how
-- patients.gender/appointments.priority are modeled, since invoice status
-- has no cross-table reuse the way appointment_status does. And the
-- existing clinic_counters table, extended with one column, for
-- human-friendly sequential invoice numbers — the exact same mechanism
-- patient_number already uses, not a new one.

-- ---------------------------------------------------------------------------
-- clinic_counters: add invoice numbering alongside the existing patient
-- numbering column.
-- ---------------------------------------------------------------------------
alter table public.clinic_counters add column next_invoice_number integer not null default 1;

-- ---------------------------------------------------------------------------
-- invoices.
-- ---------------------------------------------------------------------------
create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  patient_id uuid not null references public.patients (id) on delete restrict,
  appointment_id uuid references public.appointments (id) on delete set null,
  invoice_number text not null default '',
  status text not null default 'draft' check (status in ('draft', 'unpaid', 'partially_paid', 'paid', 'cancelled')),
  subtotal numeric(10, 2) not null default 0 check (subtotal >= 0),
  tax_percent numeric(5, 2) not null default 0 check (tax_percent >= 0 and tax_percent <= 100),
  tax_amount numeric(10, 2) not null default 0 check (tax_amount >= 0),
  total numeric(10, 2) not null default 0 check (total >= 0),
  paid_amount numeric(10, 2) not null default 0 check (paid_amount >= 0),
  balance_due numeric(10, 2) not null default 0,
  notes text,
  issued_date date not null default current_date,
  created_by uuid references public.staff_profiles (id) on delete set null,
  updated_by uuid references public.staff_profiles (id) on delete set null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invoices_clinic_number_unique unique (clinic_id, invoice_number)
);

create index invoices_clinic_id_idx on public.invoices (clinic_id);
create index invoices_patient_id_idx on public.invoices (patient_id);
create index invoices_appointment_id_idx on public.invoices (appointment_id);
create index invoices_status_idx on public.invoices (status);
create index invoices_issued_date_idx on public.invoices (issued_date);

create trigger set_updated_at
  before update on public.invoices
  for each row execute function public.set_updated_at();

-- Assigns a human-friendly, per-clinic sequential invoice number —
-- identical mechanism to assign_patient_number() (0001/0002/0004), reusing
-- the same clinic_counters row rather than a new table.
create or replace function public.assign_invoice_number()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_number integer;
begin
  if new.invoice_number is not null and new.invoice_number <> '' then
    return new;
  end if;

  insert into public.clinic_counters (clinic_id, next_invoice_number)
  values (new.clinic_id, 2)
  on conflict (clinic_id) do update
    set next_invoice_number = public.clinic_counters.next_invoice_number + 1
  returning next_invoice_number - 1 into next_number;

  new.invoice_number := 'INV-' || to_char(next_number, 'FM000000');
  return new;
end;
$$;

create trigger assign_invoice_number
  before insert on public.invoices
  for each row execute function public.assign_invoice_number();

-- ---------------------------------------------------------------------------
-- invoice_items: only mutable while the parent invoice is 'draft' — an
-- application-layer rule (see src/lib/billing/actions.ts), not enforced
-- here, matching how e.g. "can't book in the past" is an app-layer rule on
-- top of appointments rather than a DB constraint.
-- ---------------------------------------------------------------------------
create table public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  description text not null,
  quantity numeric(10, 2) not null default 1 check (quantity > 0),
  unit_price numeric(10, 2) not null default 0 check (unit_price >= 0),
  discount_amount numeric(10, 2) not null default 0 check (discount_amount >= 0),
  line_total numeric(10, 2) not null default 0 check (line_total >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index invoice_items_clinic_id_idx on public.invoice_items (clinic_id);
create index invoice_items_invoice_id_idx on public.invoice_items (invoice_id);

create trigger set_updated_at
  before update on public.invoice_items
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- payments: soft-deleted ("void"), never hard-deleted — payment history
-- must stay reconstructable even after a correction.
-- ---------------------------------------------------------------------------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  amount numeric(10, 2) not null check (amount > 0),
  method text not null check (method in ('cash', 'visa', 'bank_transfer', 'wallet', 'other')),
  reference text,
  notes text,
  paid_at timestamptz not null default now(),
  created_by uuid references public.staff_profiles (id) on delete set null,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create index payments_clinic_id_idx on public.payments (clinic_id);
create index payments_invoice_id_idx on public.payments (invoice_id);

-- ---------------------------------------------------------------------------
-- Keeps invoices.subtotal/tax_amount/total/paid_amount/balance_due and the
-- auto-derived part of `status` correct regardless of which code path
-- changed invoice_items or payments — the same category of guarantee
-- log_appointment_status_change() (0008) provides for appointment status
-- history. 'draft' and 'cancelled' are left alone: they're set explicitly
-- by the application, never auto-derived from payment state.
-- ---------------------------------------------------------------------------
create or replace function public.recalculate_invoice_totals(target_invoice_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_subtotal numeric(10, 2);
  v_tax_percent numeric(5, 2);
  v_tax_amount numeric(10, 2);
  v_total numeric(10, 2);
  v_paid numeric(10, 2);
  v_status text;
begin
  select coalesce(sum(line_total), 0) into v_subtotal
  from public.invoice_items
  where invoice_id = target_invoice_id;

  select tax_percent, status into v_tax_percent, v_status
  from public.invoices
  where id = target_invoice_id;

  v_tax_amount := round(v_subtotal * v_tax_percent / 100, 2);
  v_total := v_subtotal + v_tax_amount;

  select coalesce(sum(amount), 0) into v_paid
  from public.payments
  where invoice_id = target_invoice_id and deleted_at is null;

  if v_status not in ('draft', 'cancelled') then
    v_status := case
      when v_paid <= 0 then 'unpaid'
      when v_paid < v_total then 'partially_paid'
      else 'paid'
    end;
  end if;

  update public.invoices
  set
    subtotal = v_subtotal,
    tax_amount = v_tax_amount,
    total = v_total,
    paid_amount = v_paid,
    balance_due = greatest(v_total - v_paid, 0),
    status = v_status
  where id = target_invoice_id;
end;
$$;

create or replace function public.trigger_recalculate_invoice_totals()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform public.recalculate_invoice_totals(old.invoice_id);
    return old;
  end if;
  perform public.recalculate_invoice_totals(new.invoice_id);
  return new;
end;
$$;

create trigger recalculate_invoice_totals_on_items
  after insert or update or delete on public.invoice_items
  for each row execute function public.trigger_recalculate_invoice_totals();

create trigger recalculate_invoice_totals_on_payments
  after insert or update or delete on public.payments
  for each row execute function public.trigger_recalculate_invoice_totals();

-- ---------------------------------------------------------------------------
-- RLS. Reads AND writes both require the matching billing permission (not
-- just clinic tenancy) — billing.view/billing.edit are deliberately not
-- granted to every role in 0007_reapply_rbac.sql, unlike appointments.view.
-- ---------------------------------------------------------------------------
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.payments enable row level security;

create policy "authorized staff can view invoices"
  on public.invoices for select
  to authenticated
  using (
    (clinic_id = (select private.current_clinic_id()) or (select private.current_staff_role()) = 'super_admin')
    and (select private.has_permission('billing.view'))
  );

create policy "authorized staff can create invoices"
  on public.invoices for insert
  to authenticated
  with check (
    (clinic_id = (select private.current_clinic_id()) or (select private.current_staff_role()) = 'super_admin')
    and (select private.has_permission('billing.edit'))
  );

create policy "authorized staff can update invoices"
  on public.invoices for update
  to authenticated
  using (clinic_id = (select private.current_clinic_id()) or (select private.current_staff_role()) = 'super_admin')
  with check (
    (clinic_id = (select private.current_clinic_id()) or (select private.current_staff_role()) = 'super_admin')
    and (select private.has_permission('billing.edit'))
  );

create policy "authorized staff can view invoice items"
  on public.invoice_items for select
  to authenticated
  using (
    (clinic_id = (select private.current_clinic_id()) or (select private.current_staff_role()) = 'super_admin')
    and (select private.has_permission('billing.view'))
  );

create policy "authorized staff can manage invoice items"
  on public.invoice_items for all
  to authenticated
  using (
    (clinic_id = (select private.current_clinic_id()) or (select private.current_staff_role()) = 'super_admin')
    and (select private.has_permission('billing.edit'))
  )
  with check (
    (clinic_id = (select private.current_clinic_id()) or (select private.current_staff_role()) = 'super_admin')
    and (select private.has_permission('billing.edit'))
  );

create policy "authorized staff can view payments"
  on public.payments for select
  to authenticated
  using (
    (clinic_id = (select private.current_clinic_id()) or (select private.current_staff_role()) = 'super_admin')
    and (select private.has_permission('billing.view'))
  );

create policy "authorized staff can manage payments"
  on public.payments for all
  to authenticated
  using (
    (clinic_id = (select private.current_clinic_id()) or (select private.current_staff_role()) = 'super_admin')
    and (select private.has_permission('billing.edit'))
  )
  with check (
    (clinic_id = (select private.current_clinic_id()) or (select private.current_staff_role()) = 'super_admin')
    and (select private.has_permission('billing.edit'))
  );

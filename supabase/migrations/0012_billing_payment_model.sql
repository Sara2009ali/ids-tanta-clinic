-- Billing Version 1, subtask 9/10 — payment model extension.
--
-- Adds a transaction-classification column to payments so a refund can be
-- recorded as its own auditable row (amount, method, reason, timestamp,
-- actor) instead of only being expressible as "void this payment" (which
-- means "this payment record was a mistake," a different real-world event
-- from "this payment happened and was later returned to the patient").
--
-- `type` is a general classification, not a refund-specific flag: 'payment'
-- is the default for every existing/ordinary row, and future categories
-- (e.g. 'adjustment', 'write-off') are a pure widening of the check
-- constraint plus a small addition to recalculate_invoice_totals()'s CASE
-- below — no new column, no new table, no change to any existing
-- relationship. `amount` stays strictly positive for every row regardless
-- of type (matches the existing `check (amount > 0)`) so every `sum(amount)`
-- call site in the app (dashboard "Paid This Month" card, etc.) can't be
-- silently corrupted by a sign error; `type` carries the meaning instead.
alter table public.payments
  add column type text not null default 'payment',
  add constraint payments_type_check check (type in ('payment', 'refund'));

-- Nets refunds against paid_amount. Only this CASE line changes from
-- 0011_billing.sql's version — everything else (subtotal/tax/total math,
-- 'draft'/'cancelled' status left alone) is unchanged.
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

  select coalesce(sum(case when type = 'refund' then -amount else amount end), 0) into v_paid
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

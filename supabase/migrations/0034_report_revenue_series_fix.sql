-- Batch 4 — Financial correctness. Replaces report_revenue_series()
-- (0017_reports.sql) in place; no schema change, no new tables/columns, no
-- RLS change. Additive `create or replace function` only, matching how
-- 0012_billing_payment_model.sql already replaced
-- recalculate_invoice_totals() in place for the same class of fix.
--
-- Two bugs, both traced against the actual repository state before this
-- migration:
--
-- 1. Refund netting. getBillingDashboardCounts() ("paid this month") nets
--    refunds out (`type = 'refund' then -amount else amount`), the same way
--    recalculate_invoice_totals() already does per-invoice. This function's
--    own 0017 comment claimed to replicate that Billing definition
--    "faithfully," but never actually applied the `type` case — it summed
--    every row's amount as positive, so a refund inflated the Revenue
--    report's total/series instead of reducing it, disagreeing with Billing
--    for the same period. Fixed with the exact same CASE expression
--    recalculate_invoice_totals() already uses.
--
-- 2. Caller-supplied clinic scope. The original signature took p_clinic_id
--    as a parameter and filtered on it directly. Every other RLS-scoped
--    read in this app (including this same function's own `payments` read)
--    instead derives clinic scope implicitly from
--    private.current_clinic_id() and never accepts it as an argument. The
--    payments SELECT policy ("authorized staff can view payments",
--    0011_billing.sql) already prevented this from being an exploitable
--    cross-clinic leak for any non-super_admin caller (RLS ANDs its own
--    `clinic_id = current_clinic_id()` onto the query regardless of
--    p_clinic_id), and the one real caller
--    (reports/revenue/page.tsx) already only ever passed the caller's own
--    staff.clinic_id — but a super_admin's current_clinic_id() is null, so
--    that same caller already short-circuits to an empty series before ever
--    invoking this RPC for a super_admin (staff.clinic_id ? ... : []).
--    Removing the parameter therefore changes no observed behavior today,
--    while bringing this one function in line with the "never trust a
--    caller-supplied clinic_id, let current_clinic_id() decide" convention
--    every other query already follows.
-- The parameter list is changing (dropping p_clinic_id), which Postgres
-- treats as a distinct overload rather than something `create or replace`
-- can update in place — without this drop, the old 4-argument version
-- (with the refund bug and the caller-supplied clinic_id) would remain
-- callable alongside the new one instead of being replaced by it.
drop function if exists public.report_revenue_series(uuid, date, date, text);

create or replace function public.report_revenue_series(
  p_start date,
  p_end date,
  p_bucket text
)
returns table (bucket_start date, revenue numeric)
language sql
stable
set search_path = ''
as $$
  select
    date_trunc(p_bucket, p.paid_at)::date as bucket_start,
    sum(case when p.type = 'refund' then -p.amount else p.amount end) as revenue
  from public.payments p
  where p.clinic_id = (select private.current_clinic_id())
    and p.deleted_at is null
    and p.paid_at >= p_start::timestamptz
    and p.paid_at < (p_end + 1)::timestamptz
  group by 1
  order by 1
$$;

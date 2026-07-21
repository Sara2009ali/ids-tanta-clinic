-- Reports & Analytics, Phase 2 (Data Layer). Per the approved architecture
-- review: the only new database object this module needs. No new tables,
-- no RLS changes, no changes to any existing table, trigger, or function.
--
-- report_revenue_series(): the one report that genuinely needs a
-- date_trunc()-grouped aggregate rather than "fetch rows, reduce in JS" —
-- everything else in Reports reuses that existing convention directly in
-- application code. Deliberately plain SQL, `stable`, NOT `security
-- definer` — unlike create_notification()/run_doctor_settlement() (which
-- need to bypass RLS to write), this only reads `payments`, so it runs
-- with the caller's own privileges and lets that table's existing RLS
-- ("authorized staff can view payments": clinic tenancy + billing.view)
-- do the access control, exactly the way resolve_compensation_rule() (0015)
-- needs no grant/revoke of its own for the same reason.
--
-- "Revenue" here is defined exactly as Billing's own
-- getBillingDashboardCounts() defines "paid this month": every non-void
-- payments row's amount, summed, with no `type` filter distinguishing
-- 'payment' from 'refund' — replicated faithfully, not changed, per the
-- approved "same definition used by Billing" decision.
create or replace function public.report_revenue_series(
  p_clinic_id uuid,
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
    sum(p.amount) as revenue
  from public.payments p
  where p.clinic_id = p_clinic_id
    and p.deleted_at is null
    and p.paid_at >= p_start::timestamptz
    and p.paid_at < (p_end + 1)::timestamptz
  group by 1
  order by 1
$$;

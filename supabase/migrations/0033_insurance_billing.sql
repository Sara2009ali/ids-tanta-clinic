-- Insurance-aware billing (commercial readiness batch, Phase 10).
--
-- Extends invoice_items with a per-line insurance split, snapshotted at the
-- moment the line is written — exactly the same "frozen forever" guarantee
-- unit_price/line_total already give (see 0011_billing.sql), just applied to
-- one more derived fact about that line. The app computes and writes these
-- three columns explicitly on every insert (see invoiceItemRows() in
-- src/lib/billing/actions.ts, using src/lib/insurance/calculations.ts's
-- computeLineInsuranceSplit — the one resolution path, mirroring how
-- resolveServicePrice is the one path for price_list_items); nothing here
-- re-derives them from the patient's *current* insurance configuration, so
-- a later change to insurance_plans.coverage_percent, the patient's plan
-- assignment, or a price list can never retroactively alter an existing
-- invoice line.
--
-- insurance_coverage_percent is nullable and is the discriminator: null
-- means "insurance was not applicable to this line" (patient had no active
-- structured insurance plan at write time — billing behaves exactly as
-- before), distinct from 0 (an active plan that happens to cover 0%).
-- insurance_covered_amount/patient_responsibility are not-null with a
-- sensible default (0 / 0) so the columns are safe to add without touching
-- invoice_items' NOT NULL discipline elsewhere in this migration.
--
-- No change to invoices.subtotal/tax_amount/total/paid_amount/balance_due
-- or recalculate_invoice_totals() — the total amount billed for a line
-- never changes because of insurance; insurance only reallocates who is
-- expected to pay it. Per Phase 9's boundary from the previous batch (and
-- Part 16 of this one), this migration does not introduce insurer
-- accounts-receivable tracking, claims, or any change to how payments are
-- recorded — those stay exactly as they are today.

alter table public.invoice_items
  add column insurance_coverage_percent numeric(5, 2)
    check (insurance_coverage_percent is null or (insurance_coverage_percent >= 0 and insurance_coverage_percent <= 100)),
  add column insurance_covered_amount numeric(10, 2) not null default 0 check (insurance_covered_amount >= 0),
  add column patient_responsibility numeric(10, 2) not null default 0 check (patient_responsibility >= 0);

-- Backfill: every invoice_items row that already exists was billed before
-- insurance-aware billing existed, so — same as if the patient had no
-- active structured insurance plan at the time — the patient was
-- responsible for the full line. insurance_coverage_percent stays null
-- (not applicable), matching new no-insurance rows going forward exactly.
update public.invoice_items
set patient_responsibility = line_total
where insurance_coverage_percent is null;

-- No RLS change: invoice_items' existing "authorized staff can view/manage
-- invoice items" policies (0011_billing.sql) are column-agnostic
-- (billing.view/billing.edit + clinic tenancy) and already cover these new
-- columns, the same reasoning 0022/0023_invoice_items_visit_type.sql relied
-- on for their own added columns.

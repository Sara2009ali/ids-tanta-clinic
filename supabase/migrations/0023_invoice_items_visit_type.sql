-- Doctors & Procedures Catalog, Phase 1 (Database Foundation) — Billing link.
--
-- Links invoice line items back to the procedure catalog (visit_types) so a
-- future billing UI can prefill description/price from a procedure instead
-- of always requiring free text. Nullable and ON DELETE SET NULL, on
-- purpose: invoice_items must keep working exactly as it does today for
-- ad-hoc line items (lab fees, discounts, anything outside the catalog),
-- and a procedure being deleted later must never retroactively block that
-- delete or corrupt a historical invoice line — the invoice_items row
-- keeps its own frozen description/unit_price regardless, it just loses
-- the catalog reference.
--
-- No RLS change needed: invoice_items' existing "authorized staff can
-- manage invoice items" / "authorized staff can view invoice items"
-- policies (0011_billing.sql) are column-agnostic (billing.view/
-- billing.edit + clinic tenancy) and already cover this new column.

alter table public.invoice_items
  add column visit_type_id uuid references public.visit_types (id) on delete set null;

create index invoice_items_visit_type_id_idx on public.invoice_items (visit_type_id);

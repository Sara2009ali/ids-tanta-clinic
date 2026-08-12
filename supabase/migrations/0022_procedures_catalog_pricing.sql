-- Doctors & Procedures Catalog, Phase 1 (Database Foundation) — Procedures.
--
-- visit_types (0008_appointments.sql) is already the clinic's procedure
-- catalog in every way that matters: appointments, compensation_rules, and
-- treatment_records all key off visit_type_id, and its own CRUD actions
-- (src/lib/appointments/visit-type-actions.ts) already call these rows
-- "procedures" in every user-facing message. Rather than introduce a
-- parallel `procedures` table, this migration extends visit_types with the
-- fields procedures need that visit_types didn't yet have: a price, an
-- optional category, and an optional billing code. No new table, and no
-- change to any existing column, trigger, or RLS policy — every write to
-- visit_types already goes through the "admins can manage visit types"
-- policy (0008), which covers new columns automatically.
--
-- category is a plain nullable text column, not a lookup table or an enum:
-- unlike appointments.priority/patients.gender (a small, genuinely fixed
-- set with no legitimate growth), a clinic's procedure categories are
-- exactly the kind of open, clinic-specific taxonomy visit_types.name
-- itself already models as free text. A category table or enum would solve
-- a problem (controlled vocabulary, cross-clinic sharing) nobody has asked
-- for yet.
--
-- price defaults to 0 (not null), matching the not-null-default-0 shape
-- invoice_items.unit_price already uses, so every existing visit_types row
-- becomes valid the instant this migration runs — no backfill required.

alter table public.visit_types
  add column price numeric(10, 2) not null default 0 check (price >= 0),
  add column category text,
  add column billing_code text;

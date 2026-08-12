-- Compensation Attribution Fix, Step 1 of 3 (Additive Database Foundation).
--
-- Root cause: sync_doctor_compensation() (0014/0015) attributes an entire
-- invoice's compensation to one procedure, read from invoices.appointment_id
-- -> appointments.visit_type_id — never from invoice_items, even though
-- invoice_items.visit_type_id (0023) has represented the *actual* billed
-- procedure per line since Phase 3. This is the confirmed, demonstrated bug
-- this 3-step effort fixes: when a receptionist changes an invoice's
-- procedure away from what was originally booked, or an invoice contains
-- more than one procedure, compensation still resolves against the
-- appointment's single original procedure.
--
-- Scope deliberately narrowed after review: doctor attribution has never
-- been shown to be wrong — it stays on appointments.doctor_id via
-- invoices.appointment_id, one per invoice, exactly as today. Only
-- procedure attribution is broken, so only procedure attribution is fixed
-- here. No invoice_items.doctor_id, no doctor selector, no InvoiceFormSheet/
-- ProcedureField/AppointmentRowActions changes. Multi-doctor-per-invoice is
-- a hypothetical Treatment Plans doesn't actually need — each appointment
-- already produces its own correctly-attributed invoice (Phase 5) — so it
-- stays out of scope rather than being built preemptively. Nothing here
-- forecloses adding it later as a small, independent, purely additive
-- follow-up if real usage ever proves it necessary.
--
-- This step is additive-only and behavior-neutral: it adds what Step 3's
-- rewritten trigger will need, without touching sync_doctor_compensation(),
-- resolve_compensation_entry(), resolve_compensation_rule(), any report, or
-- any application code. Nothing reads these new columns yet.

-- ---------------------------------------------------------------------------
-- doctor_earnings.visit_type_id: which procedure this earning was for.
-- Required structurally, not just for reporting — once one payment can
-- produce more than one earnings row (one per procedure group on a
-- multi-procedure invoice), this is what distinguishes those rows, and
-- what the widened uniqueness constraint below keys on. Nullable: an
-- unresolved/no-appointment entry, or a doctor-only catch-all rule
-- (compensation_rules.visit_type_id is null), has no single procedure —
-- and, per the constraint below, every custom (non-catalog) item on one
-- invoice is deliberately treated as one combined catch-all group.
-- ---------------------------------------------------------------------------
alter table public.doctor_earnings
  add column visit_type_id uuid references public.visit_types (id) on delete restrict;

create index doctor_earnings_visit_type_id_idx on public.doctor_earnings (visit_type_id);

-- ---------------------------------------------------------------------------
-- Widen doctor_earnings' idempotency key from (payment_id, entry_type) to
-- (payment_id, visit_type_id, entry_type) — one payment can now
-- legitimately produce one earnings row per procedure group once the
-- trigger is rewritten in Step 3.
--
-- NULLS NOT DISTINCT (Postgres 15+, confirmed available on this project's
-- Postgres 17.6): a standard UNIQUE constraint treats every NULL as
-- distinct from every other NULL, which would let two custom-item groups
-- (visit_type_id = null) for the same payment bypass this constraint
-- entirely — silently allowing a trigger retry to double-insert the
-- custom-items earnings row, contradicting this table's own "structurally
-- impossible, not just unlikely" idempotency principle (see this table's
-- original comment, 0014_doctor_compensation.sql). NULLS NOT DISTINCT
-- closes that gap by treating all-NULL visit_type_id rows as colliding for
-- uniqueness purposes, the same as any other value — exactly the
-- "every custom item on one invoice is one combined catch-all group"
-- semantics Step 3's grouping is meant to have anyway.
--
-- Widening a unique constraint can never conflict with existing data;
-- confirmed empirically (doctor_earnings has 0 rows on this database today).
-- ---------------------------------------------------------------------------
alter table public.doctor_earnings
  drop constraint doctor_earnings_payment_entry_type_unique;

alter table public.doctor_earnings
  add constraint doctor_earnings_payment_visit_type_entry_type_unique
  unique nulls not distinct (payment_id, visit_type_id, entry_type);

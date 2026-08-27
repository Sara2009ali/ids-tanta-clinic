-- Batch 6 — Recall automation. Additive only: two nullable columns, no new
-- tables, no data migration, no RLS change (existing recalls/visit_types
-- policies already cover these columns since RLS is row-level, not
-- column-level). Existing recall and visit_type rows are unaffected —
-- both new columns default to null, preserving current behavior exactly.
--
-- visit_types.recall_interval_months: configurable, per-procedure follow-up
-- interval. Nullable and with no default — a service with no interval set
-- simply never generates an automatic recall (0030_recalls.sql's own header
-- comment already rejected inventing a hardcoded dental recall-interval
-- concept; this preserves that decision by making the interval clinic-
-- configured data, never an application constant).
alter table public.visit_types
  add column recall_interval_months integer
    check (recall_interval_months is null or recall_interval_months > 0);

-- recalls.treatment_record_id: the idempotency key for automatically
-- generated recalls. Nullable — every existing recall row (all manually
-- created, per the current codebase) gets null here and is completely
-- unaffected. A plain `unique` constraint on a nullable column allows any
-- number of nulls (manual recalls) while guaranteeing at most one recall
-- can ever be linked to a given treatment record (automatic recalls) — a
-- retried insert for the same treatment_record_id is rejected by the
-- database itself, not by application-level "check first" logic that a
-- race condition could defeat.
--
-- `on delete set null` mirrors recalls.appointment_id's own convention
-- (both are optional provenance links, not the recall's identity) —
-- treatment_records are soft-deleted in practice (deleted_at), so this
-- rarely fires, but a hard delete must not cascade into destroying a
-- recall that already represents a real clinical follow-up obligation.
alter table public.recalls
  add column treatment_record_id uuid references public.treatment_records (id) on delete set null,
  add constraint recalls_treatment_record_id_unique unique (treatment_record_id);

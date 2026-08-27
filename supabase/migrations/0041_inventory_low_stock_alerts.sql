-- Batch 8 — low-stock notifications need a genuinely different dedup shape
-- than a one-shot event key: the *condition* (stock at or below reorder
-- threshold) can remain true across many scheduler runs, and the product
-- must only be notified again once it has recovered above the threshold
-- and later falls back to or below it — an edge-triggered state
-- transition, not a single point-in-time event. An `event_key` on
-- `notifications` (0040) cannot express "don't repeat while still true,
-- but do repeat after a recovery," so this is the smallest additive table
-- that can.
--
-- Clinic-scoped (unlike scheduler_runs, which is deliberately clinic-
-- independent infrastructure) — a low-stock alert is real per-clinic
-- inventory state, not scheduler plumbing. `product_id` alone would
-- already be clinic-unambiguous via inventory_products' own clinic_id, but
-- `clinic_id` is denormalized here so the job's queries and any future
-- operational view never need to join back to inventory_products just to
-- scope by clinic — the same denormalization convention doctor_profiles
-- already uses for clinic_id.
create table public.inventory_low_stock_alerts (
  product_id uuid primary key references public.inventory_products (id) on delete cascade,
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  notified_at timestamptz not null default now()
);

create index inventory_low_stock_alerts_clinic_id_idx on public.inventory_low_stock_alerts (clinic_id);

-- RLS enabled with zero policies for `authenticated`/`anon` — this table is
-- read/written exclusively by the scheduler job via the existing
-- service-role admin client (there is no staff session in a cron-triggered
-- request to scope by), the same posture 0039_scheduler_foundation.sql
-- already established for scheduler_runs. A row's existence is a
-- transient operational flag ("has this product already been notified for
-- its current low-stock episode"), not clinical or financial data, and is
-- deleted the moment the product recovers — it never accumulates
-- unboundedly the way a log/history table would.
alter table public.inventory_low_stock_alerts enable row level security;

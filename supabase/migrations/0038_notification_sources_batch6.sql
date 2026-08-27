-- Batch 6 — seeds the two new notification_sources catalog rows Batch 6's
-- event wiring needs. notifications.source has `references
-- notification_sources(key) on delete restrict` (0016_notifications.sql),
-- so create_notification() would fail with a foreign-key violation for
-- either key without this. Additive only, `on conflict do nothing` for
-- idempotent re-application, same shape as the catalog's one existing seed
-- row (compensation.rule_missing).
--
-- Both new sources are genuinely event-driven (recall auto-created from a
-- completed treatment, staff invited) — no time-based/scheduled sources
-- (appointment reminders, overdue invoices, low stock) are seeded here,
-- since nothing in this repository can fire them yet without a scheduler
-- that does not exist (see the Batch 6 report's Follow-up Findings).
insert into public.notification_sources (key, label, default_type, default_priority, module)
values
  ('recalls.auto_created', 'Automatic recall created', 'info', 'normal', 'recalls'),
  ('staff.invited', 'Staff member invited', 'info', 'low', 'staff')
on conflict (key) do nothing;

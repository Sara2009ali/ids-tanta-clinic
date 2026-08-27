-- Batch 8 — seeds the two new notification_sources catalog rows the
-- appointment-reminder and low-stock scheduler jobs need.
-- notifications.source has `references notification_sources(key) on
-- delete restrict` (0016_notifications.sql), so create_notification()
-- would fail with a foreign-key violation for either key without this.
-- Additive only, `on conflict do nothing` for idempotent re-application,
-- same shape as the catalog's existing seed rows (compensation.rule_missing,
-- recalls.auto_created, staff.invited).
insert into public.notification_sources (key, label, default_type, default_priority, module)
values
  ('appointments.reminder', 'Upcoming appointment reminder', 'info', 'normal', 'appointments'),
  ('inventory.low_stock', 'Low stock', 'warning', 'normal', 'inventory')
on conflict (key) do nothing;

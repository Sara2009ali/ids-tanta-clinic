-- Batch 8 — adds the database-backed idempotency key create_notification()
-- was missing. Additive only: one new nullable column on the existing
-- `notifications` table, one new partial unique index, and the same
-- function body plus one new optional parameter at the end.
--
-- Why this is needed: the existing create_notification()/notifications
-- schema (0016_notifications.sql) has no way to say "this exact logical
-- event has already produced a notification" — notification_recipients'
-- own unique constraint only dedupes per-recipient delivery of a
-- notification that has already been decided to exist. A scheduler job
-- retried (or run twice for the same tick, or racing another instance)
-- must not be able to create a second notification for the same
-- appointment+reminder-window, or the same event of any kind. `event_key`
-- is nullable specifically so every existing caller (the one wired
-- integration, compensation.rule_missing, and Batch 6's recall/staff-
-- invited events) is completely unaffected — none of them pass one, and a
-- partial unique index (`where event_key is not null`) only constrains
-- rows that opt in.
alter table public.notifications add column event_key text;

create unique index notifications_event_key_unique_idx
  on public.notifications (event_key)
  where event_key is not null;

-- The parameter list is changing (one new parameter appended), which
-- Postgres treats as a distinct overload rather than something `create or
-- replace` can update in place unless the drop happens first — same
-- reasoning as 0034_report_revenue_series_fix.sql's own drop-before-
-- replace, applied here because a parameter is being ADDED rather than
-- removed.
drop function if exists public.create_notification(
  uuid, text, text, text, text, uuid[], text, text, uuid, boolean, text, text, uuid
);

create or replace function public.create_notification(
  p_clinic_id uuid,
  p_source text,
  p_type text,
  p_priority text,
  p_title text,
  p_recipient_staff_ids uuid[],
  p_body text default null,
  p_entity_type text default null,
  p_entity_id uuid default null,
  p_requires_action boolean default false,
  p_action_url text default null,
  p_action_label text default null,
  p_created_by uuid default null,
  -- New, optional, and last: an existing caller that never passes this
  -- keeps behaving identically (event_key stays null, no uniqueness
  -- constraint applies). A caller that does pass one gets an atomic
  -- "insert unless this exact event already produced a notification"
  -- guarantee straight from the unique index above, not an application-
  -- level check-then-insert a retry or race could defeat.
  p_event_key text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_notification_id uuid;
begin
  if not (
    p_clinic_id = (select private.current_clinic_id())
    or (select private.current_staff_role()) = 'super_admin'
  ) then
    raise exception 'clinic mismatch';
  end if;

  if p_recipient_staff_ids is null or array_length(p_recipient_staff_ids, 1) is null then
    -- Nothing to notify — not an error, same fail-soft posture
    -- sync_doctor_compensation() already uses for "no linked appointment."
    return null;
  end if;

  if exists (
    select 1
    from unnest(p_recipient_staff_ids) as sid
    left join public.staff_profiles sp on sp.id = sid and sp.clinic_id = p_clinic_id
    where sp.id is null
  ) then
    raise exception 'recipient not found in this clinic';
  end if;

  insert into public.notifications (
    clinic_id, source, type, priority, title, body, entity_type, entity_id,
    requires_action, action_url, action_label, created_by, event_key
  ) values (
    p_clinic_id, p_source, p_type, p_priority, p_title, p_body, p_entity_type, p_entity_id,
    p_requires_action, p_action_url, p_action_label, p_created_by, p_event_key
  )
  on conflict (event_key) where event_key is not null do nothing
  returning id into v_notification_id;

  -- A null id here means either "no event_key was given" (impossible to
  -- reach this line in that case — a null event_key never conflicts) or,
  -- for a caller that did give one, "this exact event already exists."
  -- Either way there is no fresh notification to fan recipients out to.
  if v_notification_id is null then
    return null;
  end if;

  insert into public.notification_recipients (notification_id, staff_id)
  select v_notification_id, sid
  from unnest(p_recipient_staff_ids) as sid
  on conflict (notification_id, staff_id) do nothing;

  return v_notification_id;
end;
$$;

revoke all on function public.create_notification from public;
grant execute on function public.create_notification to authenticated;

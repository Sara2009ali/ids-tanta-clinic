-- Notification Center, Phase 2 (Data Layer + one wired integration).
-- Per the approved architecture review: three new, self-contained tables
-- (zero changes to any existing table's columns/constraints), recipients
-- resolved and fanned out to concrete staff_id rows at write time (not
-- computed at read time), and a single SECURITY DEFINER entry point
-- (create_notification()) that both trigger-originated and future
-- Server-Action-originated callers share — the same "one function, reused
-- by a trigger and by RPCs" shape resolve_compensation_rule() established
-- in 0015_doctor_compensation_management.sql.
--
-- Exactly one integration is wired in this migration: compensation.rule_missing,
-- added as one new call inside sync_doctor_compensation()'s existing
-- 'unresolved' branch (0014/0015) — every other line of that trigger is
-- reproduced verbatim, unchanged, per "do not modify existing business logic."

-- ---------------------------------------------------------------------------
-- notification_sources: catalog of known event sources, same shape as
-- public.permissions (synthetic uuid PK + unique text key) rather than a
-- bare text column, so the source list stays a real, queryable catalog as
-- it grows. Only the one source Phase 2 wires is seeded — every other
-- module's sources (billing.*, appointments.*, recalls.*, ...) are left for
-- their own future integration work, per Phase 2's explicit scope.
-- ---------------------------------------------------------------------------
create table public.notification_sources (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  label text not null,
  default_type text not null check (default_type in ('info', 'success', 'warning', 'critical', 'system')),
  default_priority text not null check (default_priority in ('low', 'normal', 'high', 'urgent')),
  module text not null,
  created_at timestamptz not null default now()
);

insert into public.notification_sources (key, label, default_type, default_priority, module) values
  ('compensation.rule_missing', 'Missing compensation rule', 'critical', 'high', 'compensation');

-- ---------------------------------------------------------------------------
-- notifications: the event itself, one row per occurrence — recipients are
-- a separate fan-out table below, same normalization doctor_earnings uses
-- relative to doctor_settlements. title/body are precomputed at write time,
-- not templated at read time, so a later copy change never rewrites
-- history — the same "snapshot, don't recompute" instinct behind
-- doctor_earnings.rate_snapshot. entity_type/entity_id mirror
-- audit_log.entity_type/entity_id exactly (same nullable, loosely-typed
-- pair, deliberately not a real FK — a notification can point at any
-- table). requires_action is orthogonal to type/priority (a notification's
-- severity and whether it has an attached action are independent axes).
-- No updated_at: the event is immutable once created, same as
-- doctor_earnings; only per-recipient *state* changes, and that lives in
-- notification_recipients.
-- ---------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  source text not null references public.notification_sources (key) on delete restrict,
  type text not null check (type in ('info', 'success', 'warning', 'critical', 'system')),
  priority text not null check (priority in ('low', 'normal', 'high', 'urgent')),
  title text not null,
  body text,
  entity_type text,
  entity_id uuid,
  requires_action boolean not null default false,
  action_url text,
  action_label text,
  created_by uuid references public.staff_profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index notifications_clinic_id_idx on public.notifications (clinic_id);
create index notifications_entity_idx on public.notifications (entity_type, entity_id);

-- ---------------------------------------------------------------------------
-- notification_recipients: the fan-out — one row per (notification,
-- resolved recipient). This is the table RLS actually protects, and the
-- one this module writes to for read/dismiss/archive. status is a single
-- column (not four booleans) since unread/read/dismissed/archived are
-- mutually exclusive; the three *_at timestamps are kept alongside it for
-- "when," same redundancy doctor_earnings.voided_at already has next to
-- its own state. The unique constraint makes "never deliver the same
-- notification twice to the same recipient" a database fact, not just an
-- application-logic promise — the same role doctor_earnings' (payment_id,
-- entry_type) unique constraint already plays for idempotency.
-- ---------------------------------------------------------------------------
create table public.notification_recipients (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications (id) on delete cascade,
  staff_id uuid not null references public.staff_profiles (id) on delete cascade,
  status text not null default 'unread' check (status in ('unread', 'read', 'dismissed', 'archived')),
  read_at timestamptz,
  dismissed_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  constraint notification_recipients_notification_staff_unique unique (notification_id, staff_id)
);

-- The one index this feature actually lives on: "my unread, newest first."
create index notification_recipients_staff_status_idx on public.notification_recipients (staff_id, status, created_at);
create index notification_recipients_notification_id_idx on public.notification_recipients (notification_id);

-- ---------------------------------------------------------------------------
-- create_notification(): the single write path for both new tables.
-- SECURITY DEFINER because notifications/notification_recipients have no
-- INSERT policy for authenticated at all (see RLS below) — recipient
-- fan-out has to happen atomically server-side, the same reason
-- run_doctor_settlement()/resolve_compensation_entry() (0015) are RPCs
-- instead of plain actions. Recipients arrive pre-resolved as concrete
-- staff_ids (individual/role/clinic-wide targeting is resolved by the
-- caller before this call, not inside it) — this function's only job is
-- "create the event and fan it out to exactly these people," so it stays
-- generic across every future source rather than growing a targeting-mode
-- parameter per caller.
-- ---------------------------------------------------------------------------
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
  p_created_by uuid default null
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
    requires_action, action_url, action_label, created_by
  ) values (
    p_clinic_id, p_source, p_type, p_priority, p_title, p_body, p_entity_type, p_entity_id,
    p_requires_action, p_action_url, p_action_label, p_created_by
  )
  returning id into v_notification_id;

  insert into public.notification_recipients (notification_id, staff_id)
  select v_notification_id, sid
  from unnest(p_recipient_staff_ids) as sid
  on conflict (notification_id, staff_id) do nothing;

  return v_notification_id;
end;
$$;

revoke all on function public.create_notification from public;
grant execute on function public.create_notification to authenticated;

-- ---------------------------------------------------------------------------
-- sync_doctor_compensation(): same trigger, same behavior — reproduced in
-- full from 0015_doctor_compensation_management.sql with exactly one
-- addition, inside the existing 'unresolved' branch, right after the
-- existing audit_log insert: resolve every compensation.manage holder in
-- this clinic (the same staff_profiles -> role_permissions -> permissions
-- join public.current_permissions() already does for the calling user,
-- applied here to an arbitrary clinic instead) and notify them. Every
-- other line — the rule lookup, the amount/proration math, the
-- doctor_earnings inserts, the void-handling branch — is unchanged.
-- ---------------------------------------------------------------------------
create or replace function public.sync_doctor_compensation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invoice_appointment_id uuid;
  v_invoice_subtotal numeric(10, 2);
  v_invoice_clinic_id uuid;
  v_doctor_id uuid;
  v_visit_type_id uuid;
  v_rule_id uuid;
  v_rule_type text;
  v_rule_config jsonb;
  v_full_compensation numeric(10, 2);
  v_amount numeric(10, 2);
  v_entry_type text;
  v_existing_id uuid;
  v_existing_clinic_id uuid;
  v_existing_doctor_id uuid;
  v_existing_invoice_id uuid;
  v_existing_rule_id uuid;
  v_existing_amount numeric(10, 2);
  v_existing_rate_snapshot jsonb;
  v_existing_settlement_id uuid;
  v_recipient_staff_ids uuid[];
  v_doctor_full_name text;
begin
  if tg_op = 'INSERT' then
    if new.deleted_at is not null then
      return new;
    end if;

    select i.appointment_id, i.subtotal, i.clinic_id
      into v_invoice_appointment_id, v_invoice_subtotal, v_invoice_clinic_id
      from public.invoices i
      where i.id = new.invoice_id;

    if v_invoice_appointment_id is null then
      return new;
    end if;

    select a.doctor_id, a.visit_type_id
      into v_doctor_id, v_visit_type_id
      from public.appointments a
      where a.id = v_invoice_appointment_id;

    select rr.id, rr.type, rr.config
      into v_rule_id, v_rule_type, v_rule_config
      from public.resolve_compensation_rule(v_invoice_clinic_id, v_doctor_id, v_visit_type_id, new.paid_at::date) rr;

    v_entry_type := case when new.type = 'refund' then 'reversal' else 'earning' end;

    if v_rule_id is null then
      insert into public.doctor_earnings (
        clinic_id, doctor_id, invoice_id, payment_id, compensation_rule_id, entry_type, amount, rate_snapshot
      ) values (
        v_invoice_clinic_id, v_doctor_id, new.invoice_id, new.id, null, 'unresolved', 0, null
      )
      on conflict (payment_id, entry_type) do nothing;

      insert into public.audit_log (clinic_id, actor_id, action, entity_type, entity_id, changes)
      values (
        v_invoice_clinic_id, new.created_by, 'compensation.rule_missing', 'payment', new.id,
        jsonb_build_object('invoice_id', new.invoice_id, 'doctor_id', v_doctor_id, 'visit_type_id', v_visit_type_id)
      );

      -- Notification Center Phase 2's one wired integration: notify every
      -- compensation.manage holder in this clinic. Best-effort by
      -- construction — create_notification() returns null (no exception)
      -- when there's nobody to notify, so a clinic with no admin/accountant
      -- configured yet still processes the payment/audit-log write above
      -- exactly as it did before this migration.
      select array_agg(distinct sp.id) into v_recipient_staff_ids
      from public.staff_profiles sp
      join public.role_permissions rp on rp.role_id = sp.role_id
      join public.permissions perm on perm.id = rp.permission_id
      where sp.clinic_id = v_invoice_clinic_id
        and perm.key = 'compensation.manage'
        and sp.deleted_at is null
        and sp.is_active;

      select full_name into v_doctor_full_name from public.staff_profiles where id = v_doctor_id;

      perform public.create_notification(
        p_clinic_id => v_invoice_clinic_id,
        p_source => 'compensation.rule_missing',
        p_type => 'critical',
        p_priority => 'high',
        p_title => 'Missing compensation rule',
        p_recipient_staff_ids => v_recipient_staff_ids,
        p_body => 'A payment was recorded for Dr. ' || coalesce(v_doctor_full_name, 'Unknown')
          || ' with no matching compensation rate. Add a rule to resolve it.',
        p_entity_type => 'payment',
        p_entity_id => new.id,
        p_requires_action => true,
        p_action_url => '/compensation/rules',
        p_action_label => 'Set a rule',
        p_created_by => new.created_by
      );

      return new;
    end if;

    v_full_compensation := public.compute_full_compensation(v_rule_type, v_rule_config, v_invoice_subtotal);
    v_amount := round(coalesce(new.amount * (v_full_compensation / nullif(v_invoice_subtotal, 0)), 0), 2);
    if new.type = 'refund' then
      v_amount := -v_amount;
    end if;

    insert into public.doctor_earnings (
      clinic_id, doctor_id, invoice_id, payment_id, compensation_rule_id, entry_type, amount, rate_snapshot
    ) values (
      v_invoice_clinic_id, v_doctor_id, new.invoice_id, new.id, v_rule_id, v_entry_type, v_amount,
      jsonb_build_object(
        'rule_type', v_rule_type,
        'rule_config', v_rule_config,
        'invoice_subtotal', v_invoice_subtotal,
        'payment_amount', new.amount,
        'computed_amount', v_amount
      )
    )
    on conflict (payment_id, entry_type) do nothing;

    return new;
  end if;

  if tg_op = 'UPDATE' and new.deleted_at is not null and old.deleted_at is null then
    select id, clinic_id, doctor_id, invoice_id, compensation_rule_id, amount, rate_snapshot, settlement_id
      into v_existing_id, v_existing_clinic_id, v_existing_doctor_id, v_existing_invoice_id,
        v_existing_rule_id, v_existing_amount, v_existing_rate_snapshot, v_existing_settlement_id
      from public.doctor_earnings
      where payment_id = new.id and entry_type in ('earning', 'reversal')
      limit 1;

    if v_existing_id is null then
      return new;
    end if;

    if v_existing_settlement_id is null then
      update public.doctor_earnings set voided_at = now() where id = v_existing_id;
    else
      insert into public.doctor_earnings (
        clinic_id, doctor_id, invoice_id, payment_id, compensation_rule_id, entry_type, amount, rate_snapshot
      ) values (
        v_existing_clinic_id, v_existing_doctor_id, v_existing_invoice_id, new.id, v_existing_rule_id,
        'correction', -v_existing_amount, v_existing_rate_snapshot
      )
      on conflict (payment_id, entry_type) do nothing;
    end if;

    return new;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS.
-- ---------------------------------------------------------------------------
alter table public.notification_sources enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_recipients enable row level security;

-- Global catalog, same posture as public.permissions/public.roles: readable
-- by any authenticated staff member, writable only via migration.
create policy "authenticated can read notification sources"
  on public.notification_sources for select
  to authenticated
  using (true);

-- notifications: select-only for authenticated — written exclusively by
-- create_notification(), never by application code, same posture
-- doctor_earnings already has toward its own writers. Deliberately
-- narrower than every other "OR super_admin" policy in this schema: even
-- super_admin still needs a matching notification_recipients row to see a
-- given notification. That's not an oversight — a notification's whole
-- point is per-recipient delivery, and letting super_admin's platform-wide
-- visibility bypass that would defeat the isolation this table exists to
-- provide (see the approved architecture review's Security Review section).
create policy "recipients can view their clinic's notifications"
  on public.notifications for select
  to authenticated
  using (
    (clinic_id = (select private.current_clinic_id()) or (select private.current_staff_role()) = 'super_admin')
    and exists (
      select 1 from public.notification_recipients nr
      where nr.notification_id = notifications.id
        and nr.staff_id = (select auth.uid())
    )
  );

-- notification_recipients: the actual boundary this whole module protects.
-- staff_id = auth.uid() is sufficient on its own (a staff row already
-- implies a clinic), same "own row" shape doctor_earnings uses for a
-- doctor's own earnings. No insert/delete policy for authenticated: rows
-- are created exclusively by create_notification() and are never deleted,
-- only transitioned through status — mirroring doctor_earnings being
-- insert-only-via-trigger with updates limited to voided_at.
create policy "staff can view their own notification recipient rows"
  on public.notification_recipients for select
  to authenticated
  using (staff_id = (select auth.uid()) or (select private.current_staff_role()) = 'super_admin');

create policy "staff can update their own notification recipient rows"
  on public.notification_recipients for update
  to authenticated
  using (staff_id = (select auth.uid()) or (select private.current_staff_role()) = 'super_admin')
  with check (staff_id = (select auth.uid()) or (select private.current_staff_role()) = 'super_admin');

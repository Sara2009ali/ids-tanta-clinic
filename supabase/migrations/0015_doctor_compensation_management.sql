-- Doctor Compensation, Phase 4 (Server Actions & Management Layer).
--
-- One approved internal refactor: rule-resolution logic (previously inline
-- in sync_doctor_compensation(), 0014_doctor_compensation.sql) is extracted
-- into resolve_compensation_rule() — a pure, SECURITY INVOKER, `stable` SQL
-- function, now the single source of truth for "which rule applies to this
-- doctor/procedure/date," reused by both the existing trigger and the two
-- new RPCs below. The WHERE/ORDER BY/LIMIT logic is copied verbatim — no
-- behavioral change, no schema change, no financial-logic change.
--
-- Two new SECURITY DEFINER RPCs, both re-checking compensation.manage and
-- clinic tenancy internally (RLS does not apply inside a SECURITY DEFINER
-- function body, so each is its own complete security boundary, not merely
-- backed by RLS the way an ordinary table write would be):
--   - run_doctor_settlement(): atomically sums a doctor's pending earnings
--     (locked via `for update` so the total and the rows actually stamped
--     can never diverge under a concurrent payment/void), creates one
--     doctor_settlements row, stamps every included doctor_earnings row.
--   - resolve_compensation_entry(): re-attempts compensation for one
--     'unresolved' entry now that a rule may exist, inserting a
--     'correction' row — never mutates the original 'unresolved' row,
--     matching the "never mutate, always add" rule established in Phase 1.
--     Protected by the same (payment_id, entry_type) uniqueness from
--     0014 — a second resolution attempt for an already-resolved entry is
--     rejected explicitly (`on conflict ... do nothing` + a null-return
--     check), not silently ignored, since this is a user-invoked action
--     expecting feedback, unlike the trigger's own automatic writes.

-- ---------------------------------------------------------------------------
-- resolve_compensation_rule: extracted from sync_doctor_compensation()'s
-- previous inline SELECT, verbatim.
-- ---------------------------------------------------------------------------
create or replace function public.resolve_compensation_rule(
  p_clinic_id uuid,
  p_doctor_id uuid,
  p_visit_type_id uuid,
  p_as_of_date date
)
returns public.compensation_rules
language sql
stable
set search_path = ''
as $$
  select cr.*
  from public.compensation_rules cr
  where cr.clinic_id = p_clinic_id
    and (cr.doctor_id = p_doctor_id or cr.doctor_id is null)
    and (cr.visit_type_id = p_visit_type_id or cr.visit_type_id is null)
    and cr.effective_from <= p_as_of_date
    and (cr.effective_to is null or cr.effective_to > p_as_of_date)
  order by
    (cr.doctor_id is not null) desc,
    (cr.visit_type_id is not null) desc,
    cr.effective_from desc
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- sync_doctor_compensation: same trigger, same behavior — the inline rule
-- SELECT is replaced by a call to resolve_compensation_rule() above; every
-- other line is unchanged from 0014_doctor_compensation.sql.
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
-- run_doctor_settlement: the only write path for doctor_settlements/the
-- settlement_id column, ever. `for update` locks the exact pending row set
-- once, into v_ids — both the total and the later stamp use that same set,
-- so a payment or void arriving mid-transaction is cleanly excluded (it
-- simply wasn't locked), never partially counted.
-- ---------------------------------------------------------------------------
create or replace function public.run_doctor_settlement(
  p_doctor_id uuid,
  p_period_start date,
  p_period_end date
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_clinic_id uuid;
  v_ids uuid[];
  v_total numeric(10, 2);
  v_settlement_id uuid;
begin
  if not (select private.has_permission('compensation.manage')) then
    raise exception 'insufficient permission';
  end if;

  if p_period_end <= p_period_start then
    raise exception 'invalid period range';
  end if;

  select clinic_id into v_clinic_id from public.staff_profiles where id = p_doctor_id;

  if v_clinic_id is null then
    raise exception 'doctor not found';
  end if;

  if not (
    v_clinic_id = (select private.current_clinic_id())
    or (select private.current_staff_role()) = 'super_admin'
  ) then
    raise exception 'doctor not found in this clinic';
  end if;

  select array_agg(id), coalesce(sum(amount), 0)
    into v_ids, v_total
    from public.doctor_earnings
    where doctor_id = p_doctor_id
      and settlement_id is null
      and voided_at is null
      and entry_type <> 'unresolved'
    for update;

  if v_ids is null or array_length(v_ids, 1) is null then
    raise exception 'nothing to settle for this doctor';
  end if;

  insert into public.doctor_settlements (
    clinic_id, doctor_id, period_start, period_end, status, total_amount, settled_by
  ) values (
    v_clinic_id, p_doctor_id, p_period_start, p_period_end, 'settled', v_total, (select auth.uid())
  )
  returning id into v_settlement_id;

  update public.doctor_earnings
  set settlement_id = v_settlement_id
  where id = any (v_ids);

  return v_settlement_id;
end;
$$;

revoke all on function public.run_doctor_settlement from public;
grant execute on function public.run_doctor_settlement to authenticated;

-- ---------------------------------------------------------------------------
-- resolve_compensation_entry: manual gap-filling for a specific
-- 'unresolved' entry, using the payment's *original* paid_at date against
-- whichever rule now covers it. The original 'unresolved' row is never
-- touched; a new 'correction' row is the only write.
-- ---------------------------------------------------------------------------
create or replace function public.resolve_compensation_entry(p_earning_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_clinic_id uuid;
  v_doctor_id uuid;
  v_invoice_id uuid;
  v_payment_id uuid;
  v_entry_type text;
  v_payment_amount numeric(10, 2);
  v_payment_type text;
  v_paid_at timestamptz;
  v_invoice_subtotal numeric(10, 2);
  v_visit_type_id uuid;
  v_rule_id uuid;
  v_rule_type text;
  v_rule_config jsonb;
  v_full_compensation numeric(10, 2);
  v_amount numeric(10, 2);
  v_new_id uuid;
begin
  if not (select private.has_permission('compensation.manage')) then
    raise exception 'insufficient permission';
  end if;

  select clinic_id, doctor_id, invoice_id, payment_id, entry_type
    into v_clinic_id, v_doctor_id, v_invoice_id, v_payment_id, v_entry_type
    from public.doctor_earnings
    where id = p_earning_id
    for update;

  if v_clinic_id is null then
    raise exception 'earning entry not found';
  end if;

  if not (
    v_clinic_id = (select private.current_clinic_id())
    or (select private.current_staff_role()) = 'super_admin'
  ) then
    raise exception 'earning entry not found';
  end if;

  if v_entry_type <> 'unresolved' then
    raise exception 'this entry does not require resolution';
  end if;

  select p.amount, p.type, p.paid_at into v_payment_amount, v_payment_type, v_paid_at
    from public.payments p
    where p.id = v_payment_id;

  select i.subtotal into v_invoice_subtotal from public.invoices i where i.id = v_invoice_id;

  select a.visit_type_id into v_visit_type_id
    from public.invoices i
    join public.appointments a on a.id = i.appointment_id
    where i.id = v_invoice_id;

  select rr.id, rr.type, rr.config
    into v_rule_id, v_rule_type, v_rule_config
    from public.resolve_compensation_rule(v_clinic_id, v_doctor_id, v_visit_type_id, v_paid_at::date) rr;

  if v_rule_id is null then
    raise exception 'still no matching compensation rule';
  end if;

  v_full_compensation := public.compute_full_compensation(v_rule_type, v_rule_config, v_invoice_subtotal);
  v_amount := round(coalesce(v_payment_amount * (v_full_compensation / nullif(v_invoice_subtotal, 0)), 0), 2);
  if v_payment_type = 'refund' then
    v_amount := -v_amount;
  end if;

  insert into public.doctor_earnings (
    clinic_id, doctor_id, invoice_id, payment_id, compensation_rule_id, entry_type, amount, rate_snapshot
  ) values (
    v_clinic_id, v_doctor_id, v_invoice_id, v_payment_id, v_rule_id, 'correction', v_amount,
    jsonb_build_object(
      'rule_type', v_rule_type,
      'rule_config', v_rule_config,
      'invoice_subtotal', v_invoice_subtotal,
      'payment_amount', v_payment_amount,
      'computed_amount', v_amount
    )
  )
  on conflict (payment_id, entry_type) do nothing
  returning id into v_new_id;

  if v_new_id is null then
    raise exception 'a correction for this payment already exists';
  end if;

  return v_new_id;
end;
$$;

revoke all on function public.resolve_compensation_entry from public;
grant execute on function public.resolve_compensation_entry to authenticated;

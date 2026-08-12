-- Compensation Attribution Fix, Step 3 of 3 (Trigger Rewrite).
--
-- Builds on 0025_doctor_earnings_visit_type_attribution.sql (the additive
-- foundation: doctor_earnings.visit_type_id + the uniqueness constraint
-- widened to unique nulls not distinct (payment_id, visit_type_id,
-- entry_type)). This migration is the actual behavior change: fixes the
-- confirmed bug where sync_doctor_compensation() attributed an entire
-- invoice's compensation to the single procedure booked on its linked
-- appointment, ignoring what invoice_items.visit_type_id (0023) actually
-- says was billed.
--
-- Scope, unchanged from the approved plan: doctor attribution stays
-- exactly as it always was — appointments.doctor_id via
-- invoices.appointment_id, one doctor per invoice. Only procedure
-- attribution moves to invoice_items. resolve_compensation_rule() and
-- compute_full_compensation() are NOT redefined here — both are reused
-- completely unchanged, called once per procedure group instead of once
-- per invoice. run_doctor_settlement() is NOT redefined either — it sums
-- by doctor_id alone and was already agnostic to how many earnings rows
-- exist per payment.

-- ---------------------------------------------------------------------------
-- sync_doctor_compensation(): now groups the paid invoice's line items by
-- visit_type_id (every custom, non-catalog item collapses into one NULL
-- group — standard GROUP BY NULL-collation, matching exactly what the
-- 0025 NULLS NOT DISTINCT constraint was widened to support) and produces
-- one doctor_earnings row per group instead of exactly one row for the
-- whole invoice.
--
-- Each group's *own* summed line_total (pre-tax, discount-inclusive — see
-- invoice_items.line_total) is the base compute_full_compensation() runs
-- against, not the invoice's total subtotal — a discount on one procedure
-- now only ever affects that procedure's own compensation, not every
-- group's. The payment-proration step is unchanged in shape: each group's
-- full compensation is scaled by this payment's share of the *invoice's*
-- total subtotal (new.amount / v_invoice_subtotal) — the same formula this
-- trigger has always used, just applied per group. For a fully paid
-- invoice this preserves the same invariant as before: the sum of every
-- group's earning equals the sum of each group's own full compensation.
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
  v_entry_type text;
  v_group record;
  v_rule public.compensation_rules;
  v_full_compensation numeric(10, 2);
  v_amount numeric(10, 2);
  v_existing record;
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
      -- No linked appointment: no doctor to attribute to. Deliberately not
      -- an 'unresolved' case (reserved for "doctor known, rule missing") —
      -- out of functional scope, not a configuration gap to flag. Same
      -- behavior as before this migration.
      return new;
    end if;

    select a.doctor_id into v_doctor_id
      from public.appointments a
      where a.id = v_invoice_appointment_id;

    v_entry_type := case when new.type = 'refund' then 'reversal' else 'earning' end;

    for v_group in
      select ii.visit_type_id, coalesce(sum(ii.line_total), 0) as group_subtotal
      from public.invoice_items ii
      where ii.invoice_id = new.invoice_id
      group by ii.visit_type_id
    loop
      select * into v_rule
        from public.resolve_compensation_rule(v_invoice_clinic_id, v_doctor_id, v_group.visit_type_id, new.paid_at::date);

      if v_rule.id is null then
        insert into public.doctor_earnings (
          clinic_id, doctor_id, invoice_id, payment_id, compensation_rule_id, entry_type, amount, visit_type_id, rate_snapshot
        ) values (
          v_invoice_clinic_id, v_doctor_id, new.invoice_id, new.id, null, 'unresolved', 0, v_group.visit_type_id, null
        )
        on conflict (payment_id, visit_type_id, entry_type) do nothing;

        insert into public.audit_log (clinic_id, actor_id, action, entity_type, entity_id, changes)
        values (
          v_invoice_clinic_id, new.created_by, 'compensation.rule_missing', 'payment', new.id,
          jsonb_build_object('invoice_id', new.invoice_id, 'doctor_id', v_doctor_id, 'visit_type_id', v_group.visit_type_id)
        );

        continue;
      end if;

      v_full_compensation := public.compute_full_compensation(v_rule.type, v_rule.config, v_group.group_subtotal);
      v_amount := round(coalesce(new.amount * (v_full_compensation / nullif(v_invoice_subtotal, 0)), 0), 2);
      if new.type = 'refund' then
        v_amount := -v_amount;
      end if;

      insert into public.doctor_earnings (
        clinic_id, doctor_id, invoice_id, payment_id, compensation_rule_id, entry_type, amount, visit_type_id, rate_snapshot
      ) values (
        v_invoice_clinic_id, v_doctor_id, new.invoice_id, new.id, v_rule.id, v_entry_type, v_amount, v_group.visit_type_id,
        jsonb_build_object(
          'rule_type', v_rule.type,
          'rule_config', v_rule.config,
          'invoice_subtotal', v_invoice_subtotal,
          'group_subtotal', v_group.group_subtotal,
          'payment_amount', new.amount,
          'computed_amount', v_amount
        )
      )
      on conflict (payment_id, visit_type_id, entry_type) do nothing;
    end loop;

    return new;
  end if;

  if tg_op = 'UPDATE' and new.deleted_at is not null and old.deleted_at is null then
    -- One payment can now have produced more than one earning/reversal row
    -- (one per procedure group) — a void must reverse every one of them,
    -- not just the first found. This is the concrete behavior fix a plain
    -- `limit 1` would have silently missed.
    for v_existing in
      select id, clinic_id, doctor_id, invoice_id, compensation_rule_id, amount, visit_type_id, rate_snapshot, settlement_id
      from public.doctor_earnings
      where payment_id = new.id and entry_type in ('earning', 'reversal')
    loop
      if v_existing.settlement_id is null then
        update public.doctor_earnings set voided_at = now() where id = v_existing.id;
      else
        insert into public.doctor_earnings (
          clinic_id, doctor_id, invoice_id, payment_id, compensation_rule_id, entry_type, amount, visit_type_id, rate_snapshot
        ) values (
          v_existing.clinic_id, v_existing.doctor_id, v_existing.invoice_id, new.id, v_existing.compensation_rule_id,
          'correction', -v_existing.amount, v_existing.visit_type_id, v_existing.rate_snapshot
        )
        on conflict (payment_id, visit_type_id, entry_type) do nothing;
      end if;
    end loop;

    return new;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- resolve_compensation_entry(): re-attempts compensation for one specific
-- 'unresolved' doctor_earnings row (now a specific payment+procedure-group
-- pair, not necessarily "the whole payment"). Reads visit_type_id directly
-- off the row being resolved instead of re-deriving it from
-- invoices/appointments — simpler, and it closes a smaller instance of the
-- exact same staleness bug this whole effort exists to fix (the old
-- derivation would have re-read the appointment's original procedure, not
-- the group this specific unresolved entry was actually for). Also uses
-- that group's own summed line_total as the compensation base, matching
-- the trigger above, instead of the invoice's whole subtotal.
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
  v_visit_type_id uuid;
  v_payment_amount numeric(10, 2);
  v_payment_type text;
  v_paid_at timestamptz;
  v_invoice_subtotal numeric(10, 2);
  v_group_subtotal numeric(10, 2);
  v_rule public.compensation_rules;
  v_full_compensation numeric(10, 2);
  v_amount numeric(10, 2);
  v_new_id uuid;
begin
  if not (select private.has_permission('compensation.manage')) then
    raise exception 'insufficient permission';
  end if;

  select clinic_id, doctor_id, invoice_id, payment_id, entry_type, visit_type_id
    into v_clinic_id, v_doctor_id, v_invoice_id, v_payment_id, v_entry_type, v_visit_type_id
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

  select coalesce(sum(ii.line_total), 0) into v_group_subtotal
    from public.invoice_items ii
    where ii.invoice_id = v_invoice_id
      and ii.visit_type_id is not distinct from v_visit_type_id;

  select * into v_rule
    from public.resolve_compensation_rule(v_clinic_id, v_doctor_id, v_visit_type_id, v_paid_at::date);

  if v_rule.id is null then
    raise exception 'still no matching compensation rule';
  end if;

  v_full_compensation := public.compute_full_compensation(v_rule.type, v_rule.config, v_group_subtotal);
  v_amount := round(coalesce(v_payment_amount * (v_full_compensation / nullif(v_invoice_subtotal, 0)), 0), 2);
  if v_payment_type = 'refund' then
    v_amount := -v_amount;
  end if;

  insert into public.doctor_earnings (
    clinic_id, doctor_id, invoice_id, payment_id, compensation_rule_id, entry_type, amount, visit_type_id, rate_snapshot
  ) values (
    v_clinic_id, v_doctor_id, v_invoice_id, v_payment_id, v_rule.id, 'correction', v_amount, v_visit_type_id,
    jsonb_build_object(
      'rule_type', v_rule.type,
      'rule_config', v_rule.config,
      'invoice_subtotal', v_invoice_subtotal,
      'group_subtotal', v_group_subtotal,
      'payment_amount', v_payment_amount,
      'computed_amount', v_amount
    )
  )
  on conflict (payment_id, visit_type_id, entry_type) do nothing
  returning id into v_new_id;

  if v_new_id is null then
    raise exception 'a correction for this payment already exists';
  end if;

  return v_new_id;
end;
$$;

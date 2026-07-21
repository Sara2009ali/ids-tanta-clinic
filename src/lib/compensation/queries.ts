import "server-only";

import { createClient } from "@/lib/supabase/server";
import { listDoctors } from "@/lib/patients/queries";
import type { AuditLogEntry, CompensationRule, DoctorEarning, DoctorSettlement, Payment } from "@/types/domain";

export interface CompensationRulesParams {
  /** Omit for every rule in the clinic; pass to scope to one doctor's rules (their own overrides plus clinic-wide defaults, per the RLS shape). */
  doctorId?: string;
}

/** Every rule, most recently effective first — callers resolve precedence (doctor+visit_type > doctor-only > visit_type-only) themselves, same as the trigger does. */
export async function getCompensationRules(params: CompensationRulesParams = {}): Promise<CompensationRule[]> {
  const supabase = await createClient();

  let query = supabase.from("compensation_rules").select("*").order("effective_from", { ascending: false });
  if (params.doctorId) query = query.eq("doctor_id", params.doctorId);

  const { data, error } = await query;
  if (error) {
    console.error("getCompensationRules failed", error);
    return [];
  }
  return data ?? [];
}

export interface DoctorEarningsParams {
  doctorId: string;
  /** true = only settlement_id is null (pending); false/omitted = every entry, settled or not. Mutually exclusive with settlementId in practice — pass at most one. */
  pendingOnly?: boolean;
  /** Scope to exactly one settlement's swept entries — for drilling into a historical statement from the settlements list. */
  settlementId?: string;
}

/** A doctor's earnings ledger — every entry_type, including 'unresolved' and voided rows, for a complete history. Ordered most recent first. */
export async function getDoctorEarnings(params: DoctorEarningsParams): Promise<DoctorEarning[]> {
  const supabase = await createClient();

  let query = supabase
    .from("doctor_earnings")
    .select("*")
    .eq("doctor_id", params.doctorId)
    .order("created_at", { ascending: false });
  if (params.pendingOnly) query = query.is("settlement_id", null);
  if (params.settlementId) query = query.eq("settlement_id", params.settlementId);

  const { data, error } = await query;
  if (error) {
    console.error("getDoctorEarnings failed", error);
    return [];
  }
  return data ?? [];
}

/** A doctor's settlement history — permanent, immutable statements, most recent first. */
export async function getDoctorSettlements(doctorId: string): Promise<DoctorSettlement[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("doctor_settlements")
    .select("*")
    .eq("doctor_id", doctorId)
    .order("period_start", { ascending: false });

  if (error) {
    console.error("getDoctorSettlements failed", error);
    return [];
  }
  return data ?? [];
}

/**
 * Clinic-wide list of payments that generated no compensation because no
 * rule matched — the data-layer foundation for the administrative warning
 * called for in the approved architecture (Doctor Compensation Phase 1,
 * clarification 1). Consumed by the Unresolved Compensation page.
 *
 * resolve_compensation_entry() (0015) never mutates the original
 * 'unresolved' row when a gap is filled — it only appends a 'correction'
 * row for the same payment_id, matching this ledger's "never mutate,
 * always add" rule. So an 'unresolved' row alone doesn't mean "still
 * unresolved"; a payment_id with a 'correction' row already has one. A
 * payment_id can't carry both an 'unresolved' row and a *void-driven*
 * 'correction' row (that path requires a pre-existing 'earning'/'reversal'
 * row for the same payment_id, which an 'unresolved' payment never has),
 * so any 'correction' sharing a payment_id with an 'unresolved' row can
 * only have come from a manual resolve — safe to exclude here.
 */
export async function getUnresolvedCompensationEntries(): Promise<DoctorEarning[]> {
  const supabase = await createClient();

  const [{ data, error }, { data: corrections, error: correctionsError }] = await Promise.all([
    supabase.from("doctor_earnings").select("*").eq("entry_type", "unresolved").order("created_at", { ascending: false }),
    supabase.from("doctor_earnings").select("payment_id").eq("entry_type", "correction"),
  ]);

  if (error) {
    console.error("getUnresolvedCompensationEntries failed", error);
    return [];
  }
  if (correctionsError) {
    console.error("getUnresolvedCompensationEntries: correction lookup failed", correctionsError);
    return data ?? [];
  }

  const resolvedPaymentIds = new Set((corrections ?? []).map((row) => row.payment_id));
  return (data ?? []).filter((entry) => !resolvedPaymentIds.has(entry.payment_id));
}

/**
 * Plain amount lookup for a set of payments — display-only context for the
 * Unresolved Compensation screen (an unresolved doctor_earnings row's own
 * `amount` is always 0, since no rule matched). Not a Billing feature; just
 * a direct read of the same `payments` table Billing itself writes to.
 */
export async function getPaymentsByIds(paymentIds: string[]): Promise<Pick<Payment, "id" | "amount">[]> {
  if (paymentIds.length === 0) return [];
  const supabase = await createClient();

  const { data, error } = await supabase.from("payments").select("id, amount").in("id", paymentIds);

  if (error) {
    console.error("getPaymentsByIds failed", error);
    return [];
  }
  return data ?? [];
}

export interface DoctorEarningsSummary {
  /** Sum of non-voided entries with settlement_id null — what the doctor is currently owed and hasn't been paid out yet. */
  pendingTotal: number;
  /** Sum of every settled entry, ever — lifetime settled earnings. */
  settledTotal: number;
  /** Count of 'unresolved' entries for this doctor — configuration gaps needing a rule. */
  unresolvedCount: number;
}

/** One round trip per figure, run in parallel — same shape as getBillingDashboardCounts(). */
export async function getDoctorEarningsSummary(doctorId: string): Promise<DoctorEarningsSummary> {
  const supabase = await createClient();

  const [pendingRes, settledRes, unresolvedRes] = await Promise.all([
    supabase
      .from("doctor_earnings")
      .select("amount")
      .eq("doctor_id", doctorId)
      .is("settlement_id", null)
      .is("voided_at", null)
      .neq("entry_type", "unresolved"),
    supabase.from("doctor_earnings").select("amount").eq("doctor_id", doctorId).not("settlement_id", "is", null),
    supabase
      .from("doctor_earnings")
      .select("*", { count: "exact", head: true })
      .eq("doctor_id", doctorId)
      .eq("entry_type", "unresolved"),
  ]);

  const pendingTotal = (pendingRes.data ?? []).reduce((sum, row) => sum + Number(row.amount), 0);
  const settledTotal = (settledRes.data ?? []).reduce((sum, row) => sum + Number(row.amount), 0);

  return {
    pendingTotal,
    settledTotal,
    unresolvedCount: unresolvedRes.count ?? 0,
  };
}

export interface ClinicCompensationSummary {
  /** Sum of every doctor's pending (unsettled, non-voided, resolved) earnings — the total the clinic currently owes. */
  pendingTotal: number;
  /** Sum of settlement total_amount for settlements settled since the start of this calendar month. */
  settledThisMonthTotal: number;
  /** Clinic-wide count of 'unresolved' entries — the Dashboard's administrative-warning figure. */
  unresolvedCount: number;
  /** Count of currently-active (effective_to is null) compensation rules, any doctor/procedure. */
  activeRulesCount: number;
}

/** Dashboard stat cards — 4 round trips run in parallel, same shape as getBillingDashboardCounts(). */
export async function getClinicCompensationSummary(): Promise<ClinicCompensationSummary> {
  const supabase = await createClient();
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [pendingRes, settledRes, unresolvedRes, activeRulesRes] = await Promise.all([
    supabase
      .from("doctor_earnings")
      .select("amount")
      .is("settlement_id", null)
      .is("voided_at", null)
      .neq("entry_type", "unresolved"),
    supabase.from("doctor_settlements").select("total_amount").gte("settled_at", monthStart.toISOString()),
    supabase.from("doctor_earnings").select("*", { count: "exact", head: true }).eq("entry_type", "unresolved"),
    supabase.from("compensation_rules").select("*", { count: "exact", head: true }).is("effective_to", null),
  ]);

  const pendingTotal = (pendingRes.data ?? []).reduce((sum, row) => sum + Number(row.amount), 0);
  const settledThisMonthTotal = (settledRes.data ?? []).reduce((sum, row) => sum + Number(row.total_amount), 0);

  return {
    pendingTotal,
    settledThisMonthTotal,
    unresolvedCount: unresolvedRes.count ?? 0,
    activeRulesCount: activeRulesRes.count ?? 0,
  };
}

export interface DoctorPendingSummary {
  doctorId: string;
  fullName: string;
  pendingTotal: number;
}

/**
 * Every doctor with a non-zero pending balance, highest first. There's no
 * server-side GROUP BY available through supabase-js without a schema
 * change (a view/RPC), so this fetches every pending row clinic-wide and
 * aggregates client-side — the same "fetch then reduce in JS" shape
 * getBillingDashboardCounts() and every other dashboard aggregate in this
 * app already uses; fine at this app's established scale, revisit only if
 * a clinic's pending-row count ever grows large enough to matter.
 */
export async function getDoctorsPendingTotals(): Promise<DoctorPendingSummary[]> {
  const supabase = await createClient();

  const [{ data: earnings, error }, doctors] = await Promise.all([
    supabase
      .from("doctor_earnings")
      .select("doctor_id, amount")
      .is("settlement_id", null)
      .is("voided_at", null)
      .neq("entry_type", "unresolved"),
    listDoctors(),
  ]);

  if (error) {
    console.error("getDoctorsPendingTotals failed", error);
    return [];
  }

  const totals = new Map<string, number>();
  for (const row of earnings ?? []) {
    totals.set(row.doctor_id, (totals.get(row.doctor_id) ?? 0) + Number(row.amount));
  }

  return doctors
    .map((doctor) => ({ doctorId: doctor.id, fullName: doctor.full_name, pendingTotal: totals.get(doctor.id) ?? 0 }))
    .filter((doctor) => doctor.pendingTotal !== 0)
    .sort((a, b) => b.pendingTotal - a.pendingTotal);
}

/** Recent compensation.* audit events for the Dashboard's activity feed. */
export async function getCompensationAuditEntries(limit = 10): Promise<AuditLogEntry[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("audit_log")
    .select("*")
    .like("action", "compensation.%")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("getCompensationAuditEntries failed", error);
    return [];
  }
  return data ?? [];
}

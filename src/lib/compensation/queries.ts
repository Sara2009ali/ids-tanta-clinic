import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { CompensationRule, DoctorEarning, DoctorSettlement } from "@/types/domain";

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
 * clarification 1). No page consumes this yet; that's Phase 3+.
 */
export async function getUnresolvedCompensationEntries(): Promise<DoctorEarning[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("doctor_earnings")
    .select("*")
    .eq("entry_type", "unresolved")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getUnresolvedCompensationEntries failed", error);
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

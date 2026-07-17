"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ensurePermission } from "@/lib/authz/session";
import { PERMISSIONS } from "@/lib/authz/permissions";
import { writeAuditLog } from "@/lib/audit/log";
import {
  closeCompensationRuleFormSchema,
  closeCompensationRuleFormValuesFromFormData,
  compensationRuleFormSchema,
  compensationRuleFormValuesFromFormData,
  type CompensationRuleFormValues,
} from "@/lib/compensation/schema";
import { getDoctorEarnings } from "@/lib/compensation/queries";
import type { CompensationRuleConfig } from "@/lib/compensation/calculations";
import type { DoctorEarning } from "@/types/domain";
import type { Database } from "@/types/database.generated";

export interface CompensationRuleActionState {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: boolean;
  ruleId?: string;
}

export interface SettlementPreview {
  entries: DoctorEarning[];
  total: number;
}

export interface SettlementPreviewState {
  error?: string;
  success?: boolean;
  preview?: SettlementPreview;
}

export interface SettlementActionState {
  error?: string;
  success?: boolean;
  settlementId?: string;
}

export interface ResolveActionState {
  error?: string;
  success?: boolean;
  correctionId?: string;
}

function fieldErrorsFromZod(error: import("zod").ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !fieldErrors[key]) {
      fieldErrors[key] = issue.message;
    }
  }
  return fieldErrors;
}

function buildConfig(values: CompensationRuleFormValues): CompensationRuleConfig {
  if (values.type === "percentage") return { rate: values.rate ?? 0 };
  if (values.type === "fixed") return { amount: values.amount ?? 0 };
  return { base_amount: values.base_amount ?? 0, rate: values.rate ?? 0 };
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Create-or-replace: the single entry point for both "set a rate for the
 * first time" and "change a rate." Finds the existing active rule (if any)
 * for the exact same (clinic_id, doctor_id, visit_type_id) key, closes it,
 * then inserts the new one. Sequential writes with a compensating reopen
 * on failure — not a SECURITY DEFINER RPC — because a transient gap here
 * is caught and made visible by the existing 'unresolved' + audit-log
 * mechanism (0014_doctor_compensation.sql), the same safety net that makes
 * this safe without needing settlement's stronger atomicity guarantee.
 */
export async function setCompensationRule(formData: FormData): Promise<CompensationRuleActionState> {
  const authz = await ensurePermission(PERMISSIONS.COMPENSATION_MANAGE);
  if (!authz.ok) {
    return { error: authz.error };
  }
  const staff = authz.staff;
  if (!staff.clinic_id) {
    return { error: "Your account isn't assigned to a clinic yet." };
  }

  const parsed = compensationRuleFormSchema.safeParse(compensationRuleFormValuesFromFormData(formData));
  if (!parsed.success) {
    return { error: "Please fix the highlighted fields.", fieldErrors: fieldErrorsFromZod(parsed.error) };
  }
  const values = parsed.data;
  const effectiveFrom = values.effective_from ?? today();

  const supabase = await createClient();

  let existingQuery = supabase
    .from("compensation_rules")
    .select("id")
    .eq("clinic_id", staff.clinic_id)
    .is("effective_to", null);
  existingQuery = values.doctor_id
    ? existingQuery.eq("doctor_id", values.doctor_id)
    : existingQuery.is("doctor_id", null);
  existingQuery = values.visit_type_id
    ? existingQuery.eq("visit_type_id", values.visit_type_id)
    : existingQuery.is("visit_type_id", null);

  const { data: existing } = await existingQuery.maybeSingle();

  if (existing) {
    const { error: closeError } = await supabase
      .from("compensation_rules")
      .update({ effective_to: effectiveFrom })
      .eq("id", existing.id);
    if (closeError) {
      console.error("setCompensationRule: closing previous rule failed", closeError);
      return { error: "Couldn't update the previous rate. Please try again." };
    }
  }

  const config = buildConfig(values);

  const { data: rule, error: insertError } = await supabase
    .from("compensation_rules")
    .insert({
      clinic_id: staff.clinic_id,
      doctor_id: values.doctor_id ?? null,
      visit_type_id: values.visit_type_id ?? null,
      type: values.type,
      config: config as Database["public"]["Tables"]["compensation_rules"]["Insert"]["config"],
      effective_from: effectiveFrom,
      created_by: staff.id,
    })
    .select()
    .single();

  if (insertError || !rule) {
    console.error("setCompensationRule: insert failed", insertError);
    if (existing) {
      const { error: reopenError } = await supabase
        .from("compensation_rules")
        .update({ effective_to: null })
        .eq("id", existing.id);
      if (reopenError) {
        console.error("setCompensationRule: compensating reopen failed", reopenError);
        return {
          error:
            "The previous rate was closed but the new one couldn't be saved, and reopening the previous rate also failed. New payments for this doctor/procedure will be flagged as unresolved until this is fixed.",
        };
      }
    }
    return { error: "Couldn't save the new rate. Please try again." };
  }

  await writeAuditLog(supabase, {
    clinicId: staff.clinic_id,
    actorId: staff.id,
    action: "compensation.rule_set",
    entityType: "compensation_rule",
    entityId: rule.id,
    changes: {
      doctor_id: values.doctor_id ?? null,
      visit_type_id: values.visit_type_id ?? null,
      type: values.type,
      config,
      effective_from: effectiveFrom,
      replaced_rule_id: existing?.id ?? null,
    },
  });

  revalidatePath("/compensation");
  return { success: true, ruleId: rule.id };
}

/** Deactivates a rule without replacing it — a procedure is discontinued, a doctor's contract ends. */
export async function closeCompensationRule(ruleId: string, formData: FormData): Promise<CompensationRuleActionState> {
  const authz = await ensurePermission(PERMISSIONS.COMPENSATION_MANAGE);
  if (!authz.ok) {
    return { error: authz.error };
  }
  const staff = authz.staff;
  if (!staff.clinic_id) {
    return { error: "Your account isn't assigned to a clinic yet." };
  }

  const parsed = closeCompensationRuleFormSchema.safeParse(closeCompensationRuleFormValuesFromFormData(formData));
  if (!parsed.success) {
    return { error: "Please fix the highlighted fields.", fieldErrors: fieldErrorsFromZod(parsed.error) };
  }

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("compensation_rules")
    .select("effective_from")
    .eq("id", ruleId)
    .eq("clinic_id", staff.clinic_id)
    .is("effective_to", null)
    .maybeSingle();

  if (!existing) {
    return { error: "Active compensation rule not found." };
  }

  const effectiveTo = parsed.data.effective_to ?? today();
  if (effectiveTo <= existing.effective_from) {
    return {
      error: "Close date must be after the rule's start date.",
      fieldErrors: { effective_to: "Must be after the rule's start date." },
    };
  }

  const { error } = await supabase.from("compensation_rules").update({ effective_to: effectiveTo }).eq("id", ruleId);
  if (error) {
    console.error("closeCompensationRule: update failed", error);
    return { error: "Couldn't close the rate. Please try again." };
  }

  await writeAuditLog(supabase, {
    clinicId: staff.clinic_id,
    actorId: staff.id,
    action: "compensation.rule_closed",
    entityType: "compensation_rule",
    entityId: ruleId,
    changes: { effective_to: effectiveTo },
  });

  revalidatePath("/compensation");
  return { success: true };
}

/**
 * Read-only — no mutation, no audit event, same as viewing an invoice
 * detail page isn't audited. "Pending" here mirrors exactly what
 * run_doctor_settlement() will actually sum (settlement_id null,
 * voided_at null, entry_type <> 'unresolved') so the preview a user
 * confirms matches what execution will really do.
 */
export async function previewDoctorSettlement(doctorId: string): Promise<SettlementPreviewState> {
  const authz = await ensurePermission(PERMISSIONS.COMPENSATION_VIEW);
  if (!authz.ok) {
    return { error: authz.error };
  }

  const entries = await getDoctorEarnings({ doctorId, pendingOnly: true });
  const relevant = entries.filter((entry) => entry.entry_type !== "unresolved" && !entry.voided_at);
  const total = relevant.reduce((sum, entry) => sum + Number(entry.amount), 0);

  return { success: true, preview: { entries: relevant, total } };
}

function friendlySettlementError(message?: string): string {
  if (message?.includes("nothing to settle")) return "There's nothing pending to settle for this doctor.";
  if (message?.includes("invalid period range")) return "The settlement period is invalid.";
  if (message?.includes("insufficient permission")) return "You don't have permission to run settlements.";
  if (message?.includes("doctor not found")) return "Doctor not found.";
  return "Couldn't run the settlement. Please try again.";
}

/** Executes via run_doctor_settlement() (0015) — the sole write path for doctor_settlements and doctor_earnings.settlement_id. Immutable once created: there is no rollback action. */
export async function runDoctorSettlement(
  doctorId: string,
  periodStart: string,
  periodEnd: string,
): Promise<SettlementActionState> {
  const authz = await ensurePermission(PERMISSIONS.COMPENSATION_MANAGE);
  if (!authz.ok) {
    return { error: authz.error };
  }
  const staff = authz.staff;
  if (!staff.clinic_id) {
    return { error: "Your account isn't assigned to a clinic yet." };
  }

  const supabase = await createClient();
  const { data: settlementId, error } = await supabase.rpc("run_doctor_settlement", {
    p_doctor_id: doctorId,
    p_period_start: periodStart,
    p_period_end: periodEnd,
  });

  if (error || !settlementId) {
    console.error("runDoctorSettlement: RPC failed", error);
    return { error: friendlySettlementError(error?.message) };
  }

  await writeAuditLog(supabase, {
    clinicId: staff.clinic_id,
    actorId: staff.id,
    action: "compensation.settlement_run",
    entityType: "doctor_settlement",
    entityId: settlementId,
    changes: { doctor_id: doctorId, period_start: periodStart, period_end: periodEnd },
  });

  revalidatePath("/compensation");
  return { success: true, settlementId };
}

function friendlyResolveError(message?: string): string {
  if (message?.includes("still no matching compensation rule")) {
    return "No matching compensation rule exists yet — add one first.";
  }
  if (message?.includes("does not require resolution")) return "This entry doesn't need resolving.";
  if (message?.includes("already exists")) return "This entry has already been resolved.";
  if (message?.includes("insufficient permission")) return "You don't have permission to resolve compensation entries.";
  if (message?.includes("not found")) return "Compensation entry not found.";
  return "Couldn't resolve this entry. Please try again.";
}

/**
 * Re-attempts compensation for one 'unresolved' entry via
 * resolve_compensation_entry() (0015), presumably after the missing rule
 * has since been added. The original 'unresolved' row is never touched —
 * a new 'correction' row is the only write, matching every other
 * "never mutate, always add" rule in this ledger.
 */
export async function resolveUnresolvedEarning(earningId: string): Promise<ResolveActionState> {
  const authz = await ensurePermission(PERMISSIONS.COMPENSATION_MANAGE);
  if (!authz.ok) {
    return { error: authz.error };
  }
  const staff = authz.staff;
  if (!staff.clinic_id) {
    return { error: "Your account isn't assigned to a clinic yet." };
  }

  const supabase = await createClient();
  const { data: correctionId, error } = await supabase.rpc("resolve_compensation_entry", {
    p_earning_id: earningId,
  });

  if (error || !correctionId) {
    console.error("resolveUnresolvedEarning: RPC failed", error);
    return { error: friendlyResolveError(error?.message) };
  }

  await writeAuditLog(supabase, {
    clinicId: staff.clinic_id,
    actorId: staff.id,
    action: "compensation.entry_resolved",
    entityType: "doctor_earning",
    entityId: correctionId,
    changes: { original_earning_id: earningId },
  });

  revalidatePath("/compensation");
  return { success: true, correctionId };
}

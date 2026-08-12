"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ensurePermission } from "@/lib/authz/session";
import { PERMISSIONS } from "@/lib/authz/permissions";
import { writeAuditLog } from "@/lib/audit/log";
import { visitTypeFormSchema, visitTypeFormValuesFromFormData } from "@/lib/procedures/visit-type-schema";

export interface VisitTypeActionState {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: boolean;
}

const UNIQUE_VIOLATION = "23505";
const VISIT_TYPES_PATH = "/procedures";

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

function revalidateVisitTypePaths() {
  revalidatePath(VISIT_TYPES_PATH);
  revalidatePath("/appointments");
  revalidatePath("/reception");
  revalidatePath("/dashboard");
}

export async function createVisitType(formData: FormData): Promise<VisitTypeActionState> {
  const authz = await ensurePermission(PERMISSIONS.SETTINGS_MANAGE);
  if (!authz.ok) return { error: authz.error };
  const staff = authz.staff;
  if (!staff.clinic_id) return { error: "Your account isn't assigned to a clinic yet." };

  const parsed = visitTypeFormSchema.safeParse(visitTypeFormValuesFromFormData(formData));
  if (!parsed.success) {
    return { error: "Please fix the highlighted fields.", fieldErrors: fieldErrorsFromZod(parsed.error) };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("visit_types")
    .insert({
      name: parsed.data.name,
      category: parsed.data.category,
      default_duration_minutes: parsed.data.default_duration_minutes,
      price: parsed.data.price,
      billing_code: parsed.data.billing_code,
      color: parsed.data.color,
      clinic_id: staff.clinic_id,
    })
    .select()
    .single();

  if (error || !data) {
    if (error?.code === UNIQUE_VIOLATION) {
      return { error: "A procedure with this name already exists.", fieldErrors: { name: "Already in use" } };
    }
    console.error("createVisitType: insert failed", error);
    return { error: "Couldn't create the procedure. Please try again." };
  }

  await writeAuditLog(supabase, {
    clinicId: staff.clinic_id,
    actorId: staff.id,
    action: "visit_type.created",
    entityType: "visit_type",
    entityId: data.id,
  });

  revalidateVisitTypePaths();
  return { success: true };
}

export async function updateVisitType(visitTypeId: string, formData: FormData): Promise<VisitTypeActionState> {
  const authz = await ensurePermission(PERMISSIONS.SETTINGS_MANAGE);
  if (!authz.ok) return { error: authz.error };
  const staff = authz.staff;
  if (!staff.clinic_id) return { error: "Your account isn't assigned to a clinic yet." };

  const parsed = visitTypeFormSchema.safeParse(visitTypeFormValuesFromFormData(formData));
  if (!parsed.success) {
    return { error: "Please fix the highlighted fields.", fieldErrors: fieldErrorsFromZod(parsed.error) };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("visit_types")
    .update({
      name: parsed.data.name,
      category: parsed.data.category,
      default_duration_minutes: parsed.data.default_duration_minutes,
      price: parsed.data.price,
      billing_code: parsed.data.billing_code,
      color: parsed.data.color,
    })
    .eq("id", visitTypeId);

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      return { error: "A procedure with this name already exists.", fieldErrors: { name: "Already in use" } };
    }
    console.error("updateVisitType: update failed", error);
    return { error: "Couldn't update the procedure. Please try again." };
  }

  await writeAuditLog(supabase, {
    clinicId: staff.clinic_id,
    actorId: staff.id,
    action: "visit_type.updated",
    entityType: "visit_type",
    entityId: visitTypeId,
  });

  revalidateVisitTypePaths();
  return { success: true };
}

export async function toggleVisitTypeActive(visitTypeId: string, isActive: boolean): Promise<VisitTypeActionState> {
  const authz = await ensurePermission(PERMISSIONS.SETTINGS_MANAGE);
  if (!authz.ok) return { error: authz.error };
  const staff = authz.staff;
  if (!staff.clinic_id) return { error: "Your account isn't assigned to a clinic yet." };

  const supabase = await createClient();
  const { error } = await supabase.from("visit_types").update({ is_active: isActive }).eq("id", visitTypeId);

  if (error) {
    console.error("toggleVisitTypeActive: update failed", error);
    return { error: "Couldn't update the procedure. Please try again." };
  }

  await writeAuditLog(supabase, {
    clinicId: staff.clinic_id,
    actorId: staff.id,
    action: isActive ? "visit_type.enabled" : "visit_type.disabled",
    entityType: "visit_type",
    entityId: visitTypeId,
  });

  revalidateVisitTypePaths();
  return { success: true };
}

/**
 * Unlike deleteChair() — a chair has no historical dependents worth
 * protecting — visit_types is referenced by appointments (`on delete
 * restrict`) and compensation_rules (`on delete restrict`), so a hard
 * delete would already fail loudly at the database level once either
 * exists. This checks first so the failure is a clear, actionable message
 * ("N appointments use this — deactivate instead") rather than a raw
 * Postgres foreign-key-violation error surfacing to the user.
 *
 * invoice_items.visit_type_id (0023_invoice_items_visit_type.sql) is
 * checked here too even though its FK is `on delete set null`, not
 * `restrict` — the database would happily null it out and let the delete
 * through. Doing that silently would sever a historical invoice line's
 * only link back to the procedure it billed, which is exactly the kind of
 * quiet loss of traceability the "disable instead of delete" convention
 * exists to prevent everywhere else in this table. Blocking here keeps the
 * rule consistent: a procedure with any historical usage — scheduling,
 * compensation, clinical, or billing — is disabled, never deleted.
 */
export async function deleteVisitType(visitTypeId: string): Promise<VisitTypeActionState> {
  const authz = await ensurePermission(PERMISSIONS.SETTINGS_MANAGE);
  if (!authz.ok) return { error: authz.error };
  const staff = authz.staff;
  if (!staff.clinic_id) return { error: "Your account isn't assigned to a clinic yet." };

  const supabase = await createClient();

  const [appointmentsRes, rulesRes, treatmentRecordsRes, invoiceItemsRes] = await Promise.all([
    supabase.from("appointments").select("*", { count: "exact", head: true }).eq("visit_type_id", visitTypeId),
    supabase.from("compensation_rules").select("*", { count: "exact", head: true }).eq("visit_type_id", visitTypeId),
    supabase.from("treatment_records").select("*", { count: "exact", head: true }).eq("visit_type_id", visitTypeId),
    supabase.from("invoice_items").select("*", { count: "exact", head: true }).eq("visit_type_id", visitTypeId),
  ]);

  const referenceCount =
    (appointmentsRes.count ?? 0) + (rulesRes.count ?? 0) + (treatmentRecordsRes.count ?? 0) + (invoiceItemsRes.count ?? 0);
  if (referenceCount > 0) {
    return { error: "This procedure is used by existing appointments, invoices, or compensation rules. Disable it instead of deleting." };
  }

  const { error } = await supabase.from("visit_types").delete().eq("id", visitTypeId);

  if (error) {
    console.error("deleteVisitType: delete failed", error);
    return { error: "Couldn't delete the procedure. Please try again." };
  }

  await writeAuditLog(supabase, {
    clinicId: staff.clinic_id,
    actorId: staff.id,
    action: "visit_type.deleted",
    entityType: "visit_type",
    entityId: visitTypeId,
  });

  revalidateVisitTypePaths();
  return { success: true };
}

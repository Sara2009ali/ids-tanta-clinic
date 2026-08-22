"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ensurePermission } from "@/lib/authz/session";
import { PERMISSIONS } from "@/lib/authz/permissions";
import { writeAuditLog } from "@/lib/audit/log";
import { getPatientPriceContext } from "@/lib/pricing/queries";
import { getPatientBillingInsurance, type PatientBillingInsurance } from "@/lib/insurance/queries";
import {
  priceListFormSchema,
  priceListFormValuesFromFormData,
  priceListItemFormSchema,
  priceListItemFormValuesFromFormData,
} from "@/lib/pricing/schema";

export interface PriceListActionState {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: boolean;
  priceListId?: string;
}

const UNIQUE_VIOLATION = "23505";
const PRICE_LISTS_PATH = "/procedures/price-lists";

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

function revalidatePriceListPaths(priceListId?: string) {
  revalidatePath(PRICE_LISTS_PATH);
  if (priceListId) revalidatePath(`${PRICE_LISTS_PATH}/${priceListId}`);
  revalidatePath("/patients");
  revalidatePath("/billing");
}

export async function createPriceList(formData: FormData): Promise<PriceListActionState> {
  const authz = await ensurePermission(PERMISSIONS.SETTINGS_MANAGE);
  if (!authz.ok) return { error: authz.error };
  const staff = authz.staff;
  if (!staff.clinic_id) return { error: "Your account isn't assigned to a clinic yet." };

  const parsed = priceListFormSchema.safeParse(priceListFormValuesFromFormData(formData));
  if (!parsed.success) {
    return { error: "Please fix the highlighted fields.", fieldErrors: fieldErrorsFromZod(parsed.error) };
  }

  const supabase = await createClient();
  // is_default is never set here — only the seeded "Normal" list is ever
  // the default (see 0031_price_lists.sql); re-designating the default is
  // out of scope for this batch (see the final report's Follow-up Findings).
  const { data, error } = await supabase
    .from("price_lists")
    .insert({ name: parsed.data.name, clinic_id: staff.clinic_id })
    .select()
    .single();

  if (error || !data) {
    if (error?.code === UNIQUE_VIOLATION) {
      return { error: "A Price List with this name already exists.", fieldErrors: { name: "Already in use" } };
    }
    console.error("createPriceList: insert failed", error);
    return { error: "Couldn't create the Price List. Please try again." };
  }

  await writeAuditLog(supabase, {
    clinicId: staff.clinic_id,
    actorId: staff.id,
    action: "price_list.created",
    entityType: "price_list",
    entityId: data.id,
  });

  revalidatePriceListPaths();
  return { success: true, priceListId: data.id };
}

export async function renamePriceList(priceListId: string, formData: FormData): Promise<PriceListActionState> {
  const authz = await ensurePermission(PERMISSIONS.SETTINGS_MANAGE);
  if (!authz.ok) return { error: authz.error };
  const staff = authz.staff;
  if (!staff.clinic_id) return { error: "Your account isn't assigned to a clinic yet." };

  const supabase = await createClient();
  const { data: existing } = await supabase.from("price_lists").select("is_default").eq("id", priceListId).maybeSingle();
  if (existing?.is_default) {
    // Kept fixed rather than threaded dynamically through every place that
    // refers to "the clinic default" by name (the patient form's sentinel
    // option, the patient profile's fallback label) — the smaller fix for
    // the smaller problem, per the batch's own "no unnecessary complexity"
    // directive.
    return { error: "The default Price List's name can't be changed." };
  }

  const parsed = priceListFormSchema.safeParse(priceListFormValuesFromFormData(formData));
  if (!parsed.success) {
    return { error: "Please fix the highlighted fields.", fieldErrors: fieldErrorsFromZod(parsed.error) };
  }

  const { error } = await supabase.from("price_lists").update({ name: parsed.data.name }).eq("id", priceListId);

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      return { error: "A Price List with this name already exists.", fieldErrors: { name: "Already in use" } };
    }
    console.error("renamePriceList: update failed", error);
    return { error: "Couldn't rename the Price List. Please try again." };
  }

  await writeAuditLog(supabase, {
    clinicId: staff.clinic_id,
    actorId: staff.id,
    action: "price_list.renamed",
    entityType: "price_list",
    entityId: priceListId,
  });

  revalidatePriceListPaths(priceListId);
  return { success: true, priceListId };
}

export async function togglePriceListActive(priceListId: string, isActive: boolean): Promise<PriceListActionState> {
  const authz = await ensurePermission(PERMISSIONS.SETTINGS_MANAGE);
  if (!authz.ok) return { error: authz.error };
  const staff = authz.staff;
  if (!staff.clinic_id) return { error: "Your account isn't assigned to a clinic yet." };

  const supabase = await createClient();
  const { error } = await supabase.from("price_lists").update({ is_active: isActive }).eq("id", priceListId);

  if (error) {
    console.error("togglePriceListActive: update failed", error);
    return { error: "Couldn't update the Price List. Please try again." };
  }

  await writeAuditLog(supabase, {
    clinicId: staff.clinic_id,
    actorId: staff.id,
    action: isActive ? "price_list.enabled" : "price_list.disabled",
    entityType: "price_list",
    entityId: priceListId,
  });

  revalidatePriceListPaths();
  return { success: true };
}

/**
 * Blocks deleting the default list (every clinic must always have one) and
 * any list still assigned to a patient — same "check first, friendly error"
 * shape as deleteVisitType(). price_list_items cascade automatically; they
 * carry no historical weight of their own (see the migration header).
 */
export async function deletePriceList(priceListId: string): Promise<PriceListActionState> {
  const authz = await ensurePermission(PERMISSIONS.SETTINGS_MANAGE);
  if (!authz.ok) return { error: authz.error };
  const staff = authz.staff;
  if (!staff.clinic_id) return { error: "Your account isn't assigned to a clinic yet." };

  const supabase = await createClient();

  const { data: priceList } = await supabase.from("price_lists").select("is_default").eq("id", priceListId).maybeSingle();
  if (priceList?.is_default) {
    return { error: "The default Price List can't be deleted." };
  }

  const { count } = await supabase
    .from("patients")
    .select("*", { count: "exact", head: true })
    .eq("price_list_id", priceListId);
  if (count && count > 0) {
    return { error: "This Price List is assigned to existing patients. Reassign them first, or disable it instead." };
  }

  const { error } = await supabase.from("price_lists").delete().eq("id", priceListId);

  if (error) {
    console.error("deletePriceList: delete failed", error);
    return { error: "Couldn't delete the Price List. Please try again." };
  }

  await writeAuditLog(supabase, {
    clinicId: staff.clinic_id,
    actorId: staff.id,
    action: "price_list.deleted",
    entityType: "price_list",
    entityId: priceListId,
  });

  revalidatePriceListPaths();
  return { success: true };
}

/** Sets, updates, or clears (price = null/blank reverts to the base price) one service's override within a Price List. */
export async function setPriceListItem(
  priceListId: string,
  visitTypeId: string,
  formData: FormData,
): Promise<PriceListActionState> {
  const authz = await ensurePermission(PERMISSIONS.SETTINGS_MANAGE);
  if (!authz.ok) return { error: authz.error };
  const staff = authz.staff;
  if (!staff.clinic_id) return { error: "Your account isn't assigned to a clinic yet." };

  const parsed = priceListItemFormSchema.safeParse(priceListItemFormValuesFromFormData(formData));
  if (!parsed.success) {
    return { error: "Please fix the highlighted fields.", fieldErrors: fieldErrorsFromZod(parsed.error) };
  }

  const supabase = await createClient();

  if (parsed.data.price === null) {
    const { error } = await supabase
      .from("price_list_items")
      .delete()
      .eq("price_list_id", priceListId)
      .eq("visit_type_id", visitTypeId);

    if (error) {
      console.error("setPriceListItem: clear failed", error);
      return { error: "Couldn't clear this price. Please try again." };
    }
  } else {
    const { error } = await supabase.from("price_list_items").upsert(
      {
        clinic_id: staff.clinic_id,
        price_list_id: priceListId,
        visit_type_id: visitTypeId,
        price: parsed.data.price,
      },
      { onConflict: "price_list_id,visit_type_id" },
    );

    if (error) {
      console.error("setPriceListItem: upsert failed", error);
      return { error: "Couldn't save this price. Please try again." };
    }
  }

  await writeAuditLog(supabase, {
    clinicId: staff.clinic_id,
    actorId: staff.id,
    action: "price_list_item.updated",
    entityType: "price_list",
    entityId: priceListId,
    changes: { visit_type_id: visitTypeId, price: parsed.data.price },
  });

  revalidatePriceListPaths(priceListId);
  return { success: true };
}

export interface PatientBillingContext {
  priceListId: string | null;
  priceListName: string | null;
  defaultPriceListId: string | null;
  overrides: Record<string, number>;
  /** null when the patient has no active structured insurance plan — billing then behaves exactly as before this phase. */
  insurance: PatientBillingInsurance | null;
}

/**
 * Client-callable read (a server action, not a mutation) backing
 * InvoiceFormSheet's dynamic patient picker — the one place a patient's
 * pricing AND insurance context both need resolving after the initial page
 * load, since the patient there can change without a navigation. One round
 * trip for both, rather than two separate effects. Everywhere else (the
 * Price List item editor, the Treatment Plan item dialog) already has the
 * patient fixed for the whole page and fetches getPatientPriceContext()/
 * getPatientBillingInsurance() directly in the server component instead.
 * Returns plain objects, not a Map, to keep the server action's payload
 * uncontroversial across the RPC boundary.
 */
export async function getPatientBillingContext(patientId: string): Promise<PatientBillingContext> {
  const [context, insurance] = await Promise.all([
    getPatientPriceContext(patientId),
    getPatientBillingInsurance(patientId),
  ]);
  return {
    priceListId: context.priceListId,
    priceListName: context.priceListName,
    defaultPriceListId: context.defaultPriceListId,
    overrides: Object.fromEntries(context.overrides),
    insurance,
  };
}

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ensurePermission } from "@/lib/authz/session";
import { PERMISSIONS } from "@/lib/authz/permissions";
import { writeAuditLog } from "@/lib/audit/log";
import {
  invoiceFormSchema,
  invoiceFormValuesFromFormData,
  paymentFormSchema,
  paymentFormValuesFromFormData,
  refundFormSchema,
  refundFormValuesFromFormData,
  type InvoiceFormValues,
} from "@/lib/billing/schema";
import {
  canCancelInvoice,
  canEditInvoiceItems,
  canRecordPayment,
  canRefundPayment,
  computeInvoiceTotals,
  computeLineTotal,
} from "@/lib/billing/calculations";
import type { InvoiceStatus } from "@/types/domain";

export interface InvoiceActionState {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: boolean;
  invoiceId?: string;
}

export interface PaymentActionState {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: boolean;
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

function invoiceItemRows(values: InvoiceFormValues, invoiceId: string, clinicId: string) {
  return values.items.map((item) => ({
    invoice_id: invoiceId,
    clinic_id: clinicId,
    description: item.description,
    quantity: item.quantity,
    unit_price: item.unit_price,
    discount_amount: item.discount_amount,
    line_total: computeLineTotal({
      quantity: item.quantity,
      unitPrice: item.unit_price,
      discountAmount: item.discount_amount,
    }),
  }));
}

function revalidateInvoicePaths(invoiceId?: string) {
  revalidatePath("/billing");
  revalidatePath("/billing/invoices");
  if (invoiceId) revalidatePath(`/billing/invoices/${invoiceId}`);
}

/** Creates a draft invoice with its items in one call — items can't exist without an invoice, so this is two sequential inserts (compensating-delete on failure) matching how createPatient/patient_clinical_info is done, not a DB transaction. */
export async function createInvoice(formData: FormData): Promise<InvoiceActionState> {
  const authz = await ensurePermission(PERMISSIONS.BILLING_EDIT);
  if (!authz.ok) {
    return { error: authz.error };
  }
  const staff = authz.staff;
  if (!staff.clinic_id) {
    return { error: "Your account isn't assigned to a clinic yet." };
  }

  const parsed = invoiceFormSchema.safeParse(invoiceFormValuesFromFormData(formData));
  if (!parsed.success) {
    return { error: "Please fix the highlighted fields.", fieldErrors: fieldErrorsFromZod(parsed.error) };
  }
  const values = parsed.data;

  const supabase = await createClient();
  const { data: invoice, error } = await supabase
    .from("invoices")
    .insert({
      clinic_id: staff.clinic_id,
      patient_id: values.patient_id,
      appointment_id: values.appointment_id ?? null,
      tax_percent: values.tax_percent,
      notes: values.notes ?? null,
      created_by: staff.id,
    })
    .select()
    .single();

  if (error || !invoice) {
    console.error("createInvoice: insert failed", error);
    return { error: "Couldn't create the invoice. Please try again." };
  }

  const { error: itemsError } = await supabase
    .from("invoice_items")
    .insert(invoiceItemRows(values, invoice.id, staff.clinic_id));

  if (itemsError) {
    console.error("createInvoice: items insert failed", itemsError);
    await supabase.from("invoices").delete().eq("id", invoice.id);
    return { error: "Couldn't save the invoice items. Please try again." };
  }

  await writeAuditLog(supabase, {
    clinicId: staff.clinic_id,
    actorId: staff.id,
    action: "invoice.created",
    entityType: "invoice",
    entityId: invoice.id,
  });

  revalidateInvoicePaths(invoice.id);
  return { success: true, invoiceId: invoice.id };
}

/** Draft-only: full invoice + item replace. Rejected once the invoice has been issued (see canEditInvoiceItems). */
export async function updateInvoice(invoiceId: string, formData: FormData): Promise<InvoiceActionState> {
  const authz = await ensurePermission(PERMISSIONS.BILLING_EDIT);
  if (!authz.ok) {
    return { error: authz.error };
  }
  const staff = authz.staff;
  if (!staff.clinic_id) {
    return { error: "Your account isn't assigned to a clinic yet." };
  }

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("invoices")
    .select("status")
    .eq("id", invoiceId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!existing) {
    return { error: "Invoice not found." };
  }
  if (!canEditInvoiceItems(existing.status as InvoiceStatus)) {
    return { error: "Only draft invoices can be edited." };
  }

  const parsed = invoiceFormSchema.safeParse(invoiceFormValuesFromFormData(formData));
  if (!parsed.success) {
    return { error: "Please fix the highlighted fields.", fieldErrors: fieldErrorsFromZod(parsed.error) };
  }
  const values = parsed.data;

  const { error: updateError } = await supabase
    .from("invoices")
    .update({
      patient_id: values.patient_id,
      appointment_id: values.appointment_id ?? null,
      tax_percent: values.tax_percent,
      notes: values.notes ?? null,
      updated_by: staff.id,
    })
    .eq("id", invoiceId);

  if (updateError) {
    console.error("updateInvoice: update failed", updateError);
    return { error: "Couldn't update the invoice. Please try again." };
  }

  const { error: deleteItemsError } = await supabase.from("invoice_items").delete().eq("invoice_id", invoiceId);
  if (deleteItemsError) {
    console.error("updateInvoice: item replace (delete) failed", deleteItemsError);
    return { error: "Couldn't update the invoice items. Please try again." };
  }

  const { error: insertItemsError } = await supabase
    .from("invoice_items")
    .insert(invoiceItemRows(values, invoiceId, staff.clinic_id));
  if (insertItemsError) {
    console.error("updateInvoice: item replace (insert) failed", insertItemsError);
    return { error: "Couldn't update the invoice items. Please try again." };
  }

  const totals = computeInvoiceTotals(
    values.items.map((item) => ({
      quantity: item.quantity,
      unitPrice: item.unit_price,
      discountAmount: item.discount_amount,
    })),
    values.tax_percent,
  );

  await writeAuditLog(supabase, {
    clinicId: staff.clinic_id,
    actorId: staff.id,
    action: "invoice.updated",
    entityType: "invoice",
    entityId: invoiceId,
    changes: { tax_percent: values.tax_percent, item_count: values.items.length, total: totals.total },
  });

  revalidateInvoicePaths(invoiceId);
  return { success: true, invoiceId };
}

/** draft -> unpaid. Once issued, items lock (canEditInvoiceItems) and the invoice becomes a fixed record. */
export async function issueInvoice(invoiceId: string): Promise<InvoiceActionState> {
  const authz = await ensurePermission(PERMISSIONS.BILLING_EDIT);
  if (!authz.ok) {
    return { error: authz.error };
  }
  const staff = authz.staff;
  if (!staff.clinic_id) {
    return { error: "Your account isn't assigned to a clinic yet." };
  }

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("invoices")
    .select("status")
    .eq("id", invoiceId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!existing) {
    return { error: "Invoice not found." };
  }
  if (existing.status !== "draft") {
    return { error: "Only draft invoices can be issued." };
  }

  const { error } = await supabase
    .from("invoices")
    .update({ status: "unpaid", updated_by: staff.id })
    .eq("id", invoiceId);

  if (error) {
    console.error("issueInvoice: update failed", error);
    return { error: "Couldn't issue the invoice. Please try again." };
  }

  await writeAuditLog(supabase, {
    clinicId: staff.clinic_id,
    actorId: staff.id,
    action: "invoice.issued",
    entityType: "invoice",
    entityId: invoiceId,
  });

  revalidateInvoicePaths(invoiceId);
  return { success: true, invoiceId };
}

export async function cancelInvoice(invoiceId: string): Promise<InvoiceActionState> {
  const authz = await ensurePermission(PERMISSIONS.BILLING_EDIT);
  if (!authz.ok) {
    return { error: authz.error };
  }
  const staff = authz.staff;
  if (!staff.clinic_id) {
    return { error: "Your account isn't assigned to a clinic yet." };
  }

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("invoices")
    .select("status, paid_amount")
    .eq("id", invoiceId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!existing) {
    return { error: "Invoice not found." };
  }
  if (!canCancelInvoice(existing.status as InvoiceStatus, Number(existing.paid_amount))) {
    return {
      error:
        existing.status === "paid" || existing.status === "cancelled"
          ? "Paid or already-cancelled invoices can't be cancelled."
          : "Refund all payments on this invoice before cancelling it.",
    };
  }

  const { error } = await supabase
    .from("invoices")
    .update({ status: "cancelled", updated_by: staff.id })
    .eq("id", invoiceId)
    .is("deleted_at", null);

  if (error) {
    console.error("cancelInvoice: update failed", error);
    return { error: "Couldn't cancel the invoice. Please try again." };
  }

  await writeAuditLog(supabase, {
    clinicId: staff.clinic_id,
    actorId: staff.id,
    action: "invoice.cancelled",
    entityType: "invoice",
    entityId: invoiceId,
  });

  revalidateInvoicePaths(invoiceId);
  return { success: true, invoiceId };
}

/** Soft delete — hides the invoice from lists entirely, distinct from cancel (which keeps it visible as a cancelled record). */
export async function deleteInvoice(invoiceId: string): Promise<InvoiceActionState> {
  const authz = await ensurePermission(PERMISSIONS.BILLING_EDIT);
  if (!authz.ok) {
    return { error: authz.error };
  }
  const staff = authz.staff;
  if (!staff.clinic_id) {
    return { error: "Your account isn't assigned to a clinic yet." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("invoices")
    .update({ deleted_at: new Date().toISOString(), updated_by: staff.id })
    .eq("id", invoiceId);

  if (error) {
    console.error("deleteInvoice: update failed", error);
    return { error: "Couldn't delete the invoice. Please try again." };
  }

  await writeAuditLog(supabase, {
    clinicId: staff.clinic_id,
    actorId: staff.id,
    action: "invoice.deleted",
    entityType: "invoice",
    entityId: invoiceId,
  });

  revalidateInvoicePaths();
  return { success: true, invoiceId };
}

/** Inserting a payment row fires recalculate_invoice_totals_on_payments (0011_billing.sql), which updates paid_amount/balance_due/status atomically. */
export async function recordPayment(invoiceId: string, formData: FormData): Promise<PaymentActionState> {
  const authz = await ensurePermission(PERMISSIONS.BILLING_EDIT);
  if (!authz.ok) {
    return { error: authz.error };
  }
  const staff = authz.staff;
  if (!staff.clinic_id) {
    return { error: "Your account isn't assigned to a clinic yet." };
  }

  const supabase = await createClient();
  const { data: invoice } = await supabase
    .from("invoices")
    .select("status")
    .eq("id", invoiceId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!invoice) {
    return { error: "Invoice not found." };
  }
  if (!canRecordPayment(invoice.status as InvoiceStatus)) {
    return { error: "Payments can't be recorded on this invoice." };
  }

  const parsed = paymentFormSchema.safeParse(paymentFormValuesFromFormData(formData));
  if (!parsed.success) {
    return { error: "Please fix the highlighted fields.", fieldErrors: fieldErrorsFromZod(parsed.error) };
  }

  const { data: payment, error } = await supabase
    .from("payments")
    .insert({
      invoice_id: invoiceId,
      clinic_id: staff.clinic_id,
      amount: parsed.data.amount,
      method: parsed.data.method,
      reference: parsed.data.reference ?? null,
      notes: parsed.data.notes ?? null,
      created_by: staff.id,
    })
    .select()
    .single();

  if (error || !payment) {
    console.error("recordPayment: insert failed", error);
    return { error: "Couldn't record the payment. Please try again." };
  }

  await writeAuditLog(supabase, {
    clinicId: staff.clinic_id,
    actorId: staff.id,
    action: "payment.recorded",
    entityType: "payment",
    entityId: payment.id,
    changes: { invoice_id: invoiceId, amount: parsed.data.amount, method: parsed.data.method },
  });

  revalidateInvoicePaths(invoiceId);
  return { success: true };
}

/**
 * Records money returned to the patient as its own payments row
 * (type: 'refund') rather than mutating or voiding the original payment —
 * both the original collection and the refund are real events and must
 * both stay visible in history. recalculate_invoice_totals_on_payments
 * (0012_billing_payment_model.sql) nets it against paid_amount.
 */
export async function refundPayment(invoiceId: string, formData: FormData): Promise<PaymentActionState> {
  const authz = await ensurePermission(PERMISSIONS.BILLING_EDIT);
  if (!authz.ok) {
    return { error: authz.error };
  }
  const staff = authz.staff;
  if (!staff.clinic_id) {
    return { error: "Your account isn't assigned to a clinic yet." };
  }

  const supabase = await createClient();
  const { data: invoice } = await supabase
    .from("invoices")
    .select("status, paid_amount")
    .eq("id", invoiceId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!invoice) {
    return { error: "Invoice not found." };
  }
  if (!canRefundPayment(invoice.status as InvoiceStatus)) {
    return { error: "Refunds can't be recorded on this invoice." };
  }

  const parsed = refundFormSchema.safeParse(refundFormValuesFromFormData(formData));
  if (!parsed.success) {
    return { error: "Please fix the highlighted fields.", fieldErrors: fieldErrorsFromZod(parsed.error) };
  }

  const paidAmount = Number(invoice.paid_amount);
  if (parsed.data.amount > paidAmount) {
    return {
      error: "Refund exceeds the amount paid.",
      fieldErrors: { amount: `Can't refund more than the $${paidAmount.toFixed(2)} already paid.` },
    };
  }

  const { data: payment, error } = await supabase
    .from("payments")
    .insert({
      invoice_id: invoiceId,
      clinic_id: staff.clinic_id,
      type: "refund",
      amount: parsed.data.amount,
      method: parsed.data.method,
      reference: parsed.data.reference ?? null,
      notes: parsed.data.notes,
      created_by: staff.id,
    })
    .select()
    .single();

  if (error || !payment) {
    console.error("refundPayment: insert failed", error);
    return { error: "Couldn't record the refund. Please try again." };
  }

  await writeAuditLog(supabase, {
    clinicId: staff.clinic_id,
    actorId: staff.id,
    action: "payment.refunded",
    entityType: "payment",
    entityId: payment.id,
    changes: { invoice_id: invoiceId, amount: parsed.data.amount, reason: parsed.data.notes },
  });

  revalidateInvoicePaths(invoiceId);
  return { success: true };
}

/** Soft delete ("void") — payments are never hard-deleted, so history stays reconstructable. */
export async function voidPayment(paymentId: string, invoiceId: string): Promise<PaymentActionState> {
  const authz = await ensurePermission(PERMISSIONS.BILLING_EDIT);
  if (!authz.ok) {
    return { error: authz.error };
  }
  const staff = authz.staff;
  if (!staff.clinic_id) {
    return { error: "Your account isn't assigned to a clinic yet." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("payments").update({ deleted_at: new Date().toISOString() }).eq("id", paymentId);

  if (error) {
    console.error("voidPayment: update failed", error);
    return { error: "Couldn't void the payment. Please try again." };
  }

  await writeAuditLog(supabase, {
    clinicId: staff.clinic_id,
    actorId: staff.id,
    action: "payment.voided",
    entityType: "payment",
    entityId: paymentId,
    changes: { invoice_id: invoiceId },
  });

  revalidateInvoicePaths(invoiceId);
  return { success: true };
}

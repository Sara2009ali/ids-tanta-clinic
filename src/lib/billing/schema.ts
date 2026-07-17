import { z } from "zod";

const trimmedOptional = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined));

export const invoiceItemInputSchema = z.object({
  description: z.string().trim().min(1, "Enter a description"),
  quantity: z.coerce.number().positive("Quantity must be greater than zero"),
  unit_price: z.coerce.number().min(0, "Unit price can't be negative"),
  discount_amount: z.coerce.number().min(0, "Discount can't be negative").default(0),
});

export type InvoiceItemInputValues = z.infer<typeof invoiceItemInputSchema>;

const methodEnum = z.enum(["cash", "visa", "bank_transfer", "wallet", "other"]);

export const invoiceFormSchema = z.object({
  patient_id: z.string().min(1, "Select a patient"),
  appointment_id: trimmedOptional,
  tax_percent: z.coerce.number().min(0, "Tax can't be negative").max(100, "Tax can't exceed 100%").default(0),
  notes: trimmedOptional,
  items: z.array(invoiceItemInputSchema).min(1, "Add at least one item"),
});

export type InvoiceFormValues = z.infer<typeof invoiceFormSchema>;

export const paymentFormSchema = z.object({
  amount: z.coerce.number().positive("Enter an amount greater than zero"),
  method: methodEnum,
  reference: trimmedOptional,
  notes: trimmedOptional,
});

export type PaymentFormValues = z.infer<typeof paymentFormSchema>;

/** Reason is required (unlike payment's optional notes) — it's the audit trail's only record of why money went back out. */
export const refundFormSchema = z.object({
  amount: z.coerce.number().positive("Enter an amount greater than zero"),
  method: methodEnum,
  reference: trimmedOptional,
  notes: z.string().trim().min(1, "Explain why this refund is being issued"),
});

export type RefundFormValues = z.infer<typeof refundFormSchema>;

function str(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === "string" ? value : undefined;
}

/**
 * Parses a submitted invoice form. `items` travels as a JSON string in a
 * hidden input (set by InvoiceFormSheet just before submit) since FormData
 * has no native array/object support — the same reason PatientPicker
 * smuggles its selection through a hidden `patient_id` input rather than a
 * native multi-value field.
 */
export function invoiceFormValuesFromFormData(formData: FormData) {
  const itemsRaw = str(formData, "items") ?? "[]";
  let items: unknown;
  try {
    items = JSON.parse(itemsRaw);
  } catch {
    items = [];
  }

  return {
    patient_id: str(formData, "patient_id") ?? "",
    appointment_id: str(formData, "appointment_id"),
    tax_percent: str(formData, "tax_percent") ?? "0",
    notes: str(formData, "notes"),
    items,
  };
}

export function paymentFormValuesFromFormData(formData: FormData) {
  return {
    amount: str(formData, "amount") ?? "",
    method: str(formData, "method") ?? "cash",
    reference: str(formData, "reference"),
    notes: str(formData, "notes"),
  };
}

export function refundFormValuesFromFormData(formData: FormData) {
  return {
    amount: str(formData, "amount") ?? "",
    method: str(formData, "method") ?? "cash",
    reference: str(formData, "reference"),
    notes: str(formData, "notes"),
  };
}

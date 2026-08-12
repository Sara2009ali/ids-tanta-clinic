import { z } from "zod";

// category/billing_code are optional catalog metadata (nullable columns,
// 0022_procedures_catalog_pricing.sql) — trimmed and normalized to null
// rather than "", so "not set" has one representation, not two ("" vs
// null), matching how the rest of this schema already treats absence.
const optionalTrimmed = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .transform((value) => (value.length > 0 ? value : null));

export const visitTypeFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Enter a procedure name")
    .max(50, "Keep it under 50 characters"),
  category: optionalTrimmed(50, "Keep it under 50 characters"),
  default_duration_minutes: z.coerce
    .number()
    .int("Whole minutes only")
    .min(5, "At least 5 minutes")
    .max(480, "Keep it under 8 hours"),
  // No currency symbol/locale handling here (matches billing's own
  // unit_price field) — this is the catalog default only, never used to
  // rewrite an already-issued invoice line (see invoice_items.unit_price,
  // which is captured independently at the time a line item is created).
  price: z.coerce.number().min(0, "Price can't be negative"),
  // Deliberately no format regex (e.g. CDT/ADA pattern): clinics may use
  // different coding systems or none at all, and this catalog doesn't
  // assume one. Just a bounded free-text label.
  billing_code: optionalTrimmed(32, "Keep it under 32 characters"),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Use a hex color like #6366f1"),
});

export type VisitTypeFormValues = z.infer<typeof visitTypeFormSchema>;

function str(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === "string" ? value : undefined;
}

export function visitTypeFormValuesFromFormData(formData: FormData) {
  return {
    name: str(formData, "name") ?? "",
    category: str(formData, "category") ?? "",
    default_duration_minutes: str(formData, "default_duration_minutes") ?? "",
    price: str(formData, "price") ?? "0",
    billing_code: str(formData, "billing_code") ?? "",
    color: str(formData, "color") ?? "#6366f1",
  };
}

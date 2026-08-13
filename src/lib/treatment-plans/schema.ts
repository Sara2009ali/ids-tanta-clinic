import { z } from "zod";
import { nullableFdiNumberSchema } from "@/lib/dental-chart/schema";

const trimmedOptional = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined));

export const treatmentPlanFormSchema = z.object({
  title: trimmedOptional,
});

export type TreatmentPlanFormValues = z.infer<typeof treatmentPlanFormSchema>;

export const treatmentPlanItemPrioritySchema = z.enum(["normal", "high", "urgent"]);

export const treatmentPlanItemStatusSchema = z.enum([
  "planned",
  "accepted",
  "postponed",
  "rejected",
  "in_progress",
  "completed",
]);

export type TreatmentPlanItemStatus = z.infer<typeof treatmentPlanItemStatusSchema>;

/**
 * procedure_name/estimated_price are the source of truth for this item from
 * the moment it's created, same as invoice_items.description/unit_price —
 * visit_type_id travels alongside purely as a provenance link and is never
 * used to re-derive or overwrite these two values, here or in actions.ts.
 */
export const treatmentPlanItemFormSchema = z.object({
  procedure_name: z.string().trim().min(1, "Enter a procedure"),
  estimated_price: z.coerce.number().min(0, "Estimated price can't be negative"),
  quantity: z.coerce.number().positive("Quantity must be greater than zero").default(1),
  tooth_reference: trimmedOptional,
  // Structured, single-tooth companion to tooth_reference (0029_dental_chart.sql)
  // — additional precise reference, never a replacement. The two fields are
  // independent: selecting a tooth here never rewrites tooth_reference, and
  // vice versa, so free text describing multiple teeth/a quadrant/full mouth
  // is never clobbered by a single structured pick.
  tooth_id: nullableFdiNumberSchema,
  priority: treatmentPlanItemPrioritySchema.default("normal"),
  notes: trimmedOptional,
  visit_type_id: z.string().nullable().optional().transform((value) => value || null),
  appointment_id: trimmedOptional,
});

export type TreatmentPlanItemFormValues = z.infer<typeof treatmentPlanItemFormSchema>;

function str(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === "string" ? value : undefined;
}

export function treatmentPlanFormValuesFromFormData(formData: FormData) {
  return {
    title: str(formData, "title"),
  };
}

export function treatmentPlanItemFormValuesFromFormData(formData: FormData) {
  return {
    procedure_name: str(formData, "procedure_name") ?? "",
    estimated_price: str(formData, "estimated_price") ?? "0",
    quantity: str(formData, "quantity") ?? "1",
    tooth_reference: str(formData, "tooth_reference"),
    tooth_id: str(formData, "tooth_id") ?? "",
    priority: str(formData, "priority") ?? "normal",
    notes: str(formData, "notes"),
    visit_type_id: str(formData, "visit_type_id") || null,
    appointment_id: str(formData, "appointment_id"),
  };
}

import { z } from "zod";

const trimmedOptional = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined));

export const recallStatusSchema = z.enum(["due", "scheduled", "completed", "dismissed"]);

export type RecallStatus = z.infer<typeof recallStatusSchema>;

/**
 * `reason`/`due_date` are the source of truth for what this recall is and
 * when it's due, same "the free-typed fields are truth, the catalog link is
 * just provenance" convention treatment_plan_items already established for
 * procedure_name/estimated_price vs. visit_type_id.
 */
export const recallFormSchema = z.object({
  patient_id: z.string().min(1, "Select a patient"),
  reason: z.string().trim().min(1, "Enter a reason"),
  due_date: z
    .string()
    .min(1, "Select a due date")
    .refine((value) => !Number.isNaN(Date.parse(value)), { message: "Enter a valid date" }),
  doctor_id: z.string().nullable().optional().transform((value) => value || null),
  visit_type_id: z.string().nullable().optional().transform((value) => value || null),
  notes: trimmedOptional,
});

export type RecallFormValues = z.infer<typeof recallFormSchema>;

function str(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === "string" ? value : undefined;
}

export function recallFormValuesFromFormData(formData: FormData) {
  return {
    patient_id: str(formData, "patient_id") ?? "",
    reason: str(formData, "reason") ?? "",
    due_date: str(formData, "due_date") ?? "",
    doctor_id: str(formData, "doctor_id") || null,
    visit_type_id: str(formData, "visit_type_id") || null,
    notes: str(formData, "notes"),
  };
}

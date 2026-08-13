import { z } from "zod";

export const treatmentRecordFormSchema = z.object({
  visit_type_id: z.string().uuid("Select a procedure"),
  notes: z.string().trim().max(2000, "Keep it under 2000 characters").optional(),
  // Optional link back to the Treatment Plan item this record fulfills, if
  // any — see treatment-plans' 0028 migration and its "Do not duplicate
  // clinical facts" design note. A treatment record with no plan item stays
  // fully valid; this is never required.
  treatment_plan_item_id: z.string().trim().optional().transform((value) => (value ? value : undefined)),
});

export type TreatmentRecordFormValues = z.infer<typeof treatmentRecordFormSchema>;

function str(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === "string" ? value : undefined;
}

export function treatmentRecordFormValuesFromFormData(formData: FormData) {
  return {
    visit_type_id: str(formData, "visit_type_id") ?? "",
    notes: str(formData, "notes") || undefined,
    treatment_plan_item_id: str(formData, "treatment_plan_item_id"),
  };
}

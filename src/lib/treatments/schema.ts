import { z } from "zod";

export const treatmentRecordFormSchema = z.object({
  visit_type_id: z.string().uuid("Select a procedure"),
  notes: z.string().trim().max(2000, "Keep it under 2000 characters").optional(),
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
  };
}

import { z } from "zod";
import { nullableFdiNumberSchema } from "@/lib/dental-chart/schema";

export const treatmentRecordFormSchema = z.object({
  visit_type_id: z.string().uuid("Select a procedure"),
  notes: z.string().trim().max(2000, "Keep it under 2000 characters").optional(),
  // Optional link back to the Treatment Plan item this record fulfills, if
  // any — see treatment-plans' 0028 migration and its "Do not duplicate
  // clinical facts" design note. A treatment record with no plan item stays
  // fully valid; this is never required.
  treatment_plan_item_id: z.string().trim().optional().transform((value) => (value ? value : undefined)),
  // Structured tooth this procedure was performed on (0029_dental_chart.sql)
  // — optional, walk-in records get it just as easily as plan-linked ones.
  // Display-only linkage: setting it never writes to patient_tooth_state or
  // patient_tooth_events (see the approved architecture's "no automated
  // clinical classification" boundary) — chart state only changes through
  // an explicit edit on the Tooth Sheet.
  tooth_id: nullableFdiNumberSchema,
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
    tooth_id: str(formData, "tooth_id") ?? "",
  };
}

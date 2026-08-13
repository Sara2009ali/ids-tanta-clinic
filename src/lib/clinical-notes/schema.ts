import { z } from "zod";

const trimmedOptional = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined));

export const clinicalNoteFormSchema = z.object({
  note: z.string().trim().min(1, "Enter a note").max(4000, "Keep it under 4000 characters"),
  appointment_id: trimmedOptional,
});

export type ClinicalNoteFormValues = z.infer<typeof clinicalNoteFormSchema>;

function str(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === "string" ? value : undefined;
}

export function clinicalNoteFormValuesFromFormData(formData: FormData) {
  return {
    note: str(formData, "note") ?? "",
    appointment_id: str(formData, "appointment_id"),
  };
}

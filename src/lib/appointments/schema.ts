import { z } from "zod";

const trimmedOptional = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined));

const priorityEnum = z.enum(["normal", "high", "urgent"]);

export const appointmentFormSchema = z
  .object({
    patient_id: z.string().min(1, "Select a patient"),
    doctor_id: z.string().min(1, "Select a doctor"),
    chair_id: trimmedOptional,
    visit_type_id: z.string().min(1, "Select a visit type"),
    scheduled_date: z.string().min(1, "Select a date"),
    scheduled_time: z.string().min(1, "Select a time"),
    duration_minutes: z.coerce
      .number({ error: "Enter a duration" })
      .int("Duration must be a whole number of minutes")
      .min(5, "Duration must be at least 5 minutes")
      .max(480, "Duration can't exceed 8 hours"),
    priority: priorityEnum.default("normal"),
    is_emergency: z.boolean().default(false),
    chief_complaint: trimmedOptional,
    notes: trimmedOptional,
  })
  .refine(
    (values) => !Number.isNaN(Date.parse(`${values.scheduled_date}T${values.scheduled_time}`)),
    { message: "Enter a valid date and time", path: ["scheduled_time"] },
  )
  .transform((values) => ({
    ...values,
    scheduled_start: new Date(`${values.scheduled_date}T${values.scheduled_time}`).toISOString(),
  }));

export type AppointmentFormValues = z.infer<typeof appointmentFormSchema>;

function str(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === "string" ? value : undefined;
}

function bool(formData: FormData, key: string): boolean {
  return formData.get(key) === "on" || formData.get(key) === "true";
}

/** Parses a submitted appointment form into the shape appointmentFormSchema expects. */
export function appointmentFormValuesFromFormData(formData: FormData) {
  return {
    patient_id: str(formData, "patient_id") ?? "",
    doctor_id: str(formData, "doctor_id") ?? "",
    chair_id: str(formData, "chair_id"),
    visit_type_id: str(formData, "visit_type_id") ?? "",
    scheduled_date: str(formData, "scheduled_date") ?? "",
    scheduled_time: str(formData, "scheduled_time") ?? "",
    duration_minutes: str(formData, "duration_minutes") ?? "",
    priority: str(formData, "priority") ?? "normal",
    is_emergency: bool(formData, "is_emergency"),
    chief_complaint: str(formData, "chief_complaint"),
    notes: str(formData, "notes"),
  };
}

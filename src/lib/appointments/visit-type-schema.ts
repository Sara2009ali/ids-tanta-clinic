import { z } from "zod";

export const visitTypeFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Enter a procedure name")
    .max(50, "Keep it under 50 characters"),
  default_duration_minutes: z.coerce
    .number()
    .int("Whole minutes only")
    .min(5, "At least 5 minutes")
    .max(480, "Keep it under 8 hours"),
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
    default_duration_minutes: str(formData, "default_duration_minutes") ?? "",
    color: str(formData, "color") ?? "#6366f1",
  };
}

import { z } from "zod";

export const insurerFormSchema = z.object({
  name: z.string().trim().min(1, "Enter an insurer name").max(80, "Keep it under 80 characters"),
});

export type InsurerFormValues = z.infer<typeof insurerFormSchema>;

export const insurancePlanFormSchema = z.object({
  name: z.string().trim().min(1, "Enter a plan name").max(80, "Keep it under 80 characters"),
  coverage_percent: z.coerce
    .number()
    .min(0, "Coverage can't be negative")
    .max(100, "Coverage can't exceed 100%"),
});

export type InsurancePlanFormValues = z.infer<typeof insurancePlanFormSchema>;

function str(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === "string" ? value : undefined;
}

export function insurerFormValuesFromFormData(formData: FormData) {
  return { name: str(formData, "name") ?? "" };
}

export function insurancePlanFormValuesFromFormData(formData: FormData) {
  return {
    name: str(formData, "name") ?? "",
    coverage_percent: str(formData, "coverage_percent") ?? "100",
  };
}

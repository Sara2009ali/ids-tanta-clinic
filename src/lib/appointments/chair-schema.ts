import { z } from "zod";

export const chairFormSchema = z.object({
  label: z
    .string()
    .trim()
    .min(1, "Enter a chair name")
    .max(50, "Keep it under 50 characters"),
});

export type ChairFormValues = z.infer<typeof chairFormSchema>;

function str(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === "string" ? value : undefined;
}

export function chairFormValuesFromFormData(formData: FormData) {
  return { label: str(formData, "label") ?? "" };
}

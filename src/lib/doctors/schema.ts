import { z } from "zod";

const trimmedOptional = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined));

/**
 * Email is required here even though the resulting account starts with
 * sign-in disabled (see actions.ts) — staff_profiles.id is a hard FK to
 * auth.users.id (0001_phase1_foundation.sql), so creating a doctor record
 * at all means an auth identity must exist. The form frames this as a
 * "login email" rather than exposing that constraint directly.
 */
export const doctorCreateFormSchema = z.object({
  full_name: z.string().trim().min(1, "Enter the doctor's name").max(100, "Keep it under 100 characters"),
  phone: trimmedOptional,
  email: z
    .string()
    .trim()
    .min(1, "Enter a login email")
    .email("Enter a valid email address")
    .max(150, "Keep it under 150 characters"),
  specialty: trimmedOptional,
  license_number: trimmedOptional,
});

export type DoctorCreateFormValues = z.infer<typeof doctorCreateFormSchema>;

/** No email field — the login identity isn't editable from the profile form; see actions.ts's account-management actions instead. */
export const doctorEditFormSchema = z.object({
  full_name: z.string().trim().min(1, "Enter the doctor's name").max(100, "Keep it under 100 characters"),
  phone: trimmedOptional,
  specialty: trimmedOptional,
  license_number: trimmedOptional,
  bio: trimmedOptional,
  color: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Use a hex color like #6366f1"),
});

export type DoctorEditFormValues = z.infer<typeof doctorEditFormSchema>;

function str(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === "string" ? value : undefined;
}

export function doctorCreateFormValuesFromFormData(formData: FormData) {
  return {
    full_name: str(formData, "full_name") ?? "",
    phone: str(formData, "phone"),
    email: str(formData, "email") ?? "",
    specialty: str(formData, "specialty"),
    license_number: str(formData, "license_number"),
  };
}

export function doctorEditFormValuesFromFormData(formData: FormData) {
  return {
    full_name: str(formData, "full_name") ?? "",
    phone: str(formData, "phone"),
    specialty: str(formData, "specialty"),
    license_number: str(formData, "license_number"),
    bio: str(formData, "bio"),
    color: str(formData, "color") ?? "#6366f1",
  };
}

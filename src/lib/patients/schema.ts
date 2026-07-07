import { z } from "zod";

const trimmedOptional = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined));

const genderEnum = z.enum(["male", "female", "other", "unspecified"]);

export const patientFormSchema = z.object({
  first_name: z.string().trim().min(1, "First name is required").max(120),
  last_name: z.string().trim().min(1, "Last name is required").max(120),
  date_of_birth: z
    .string()
    .optional()
    .transform((value) => (value ? value : undefined))
    .refine((value) => !value || !Number.isNaN(Date.parse(value)), {
      message: "Enter a valid date",
    })
    .refine((value) => !value || new Date(value) <= new Date(), {
      message: "Date of birth can't be in the future",
    }),
  gender: genderEnum.optional(),
  phone: trimmedOptional,
  email: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? value : undefined))
    .refine((value) => !value || z.string().email().safeParse(value).success, {
      message: "Enter a valid email address",
    }),
  address: trimmedOptional,
  national_id: trimmedOptional,
  occupation: trimmedOptional,
  emergency_contact_name: trimmedOptional,
  emergency_contact_phone: trimmedOptional,

  allergies: z.array(z.string().trim()).default([]),
  current_medications: z.array(z.string().trim()).default([]),
  medical_conditions: z.array(z.string().trim()).default([]),
  is_pregnant: z.boolean().default(false),
  is_smoker: z.boolean().default(false),
  has_hypertension: z.boolean().default(false),
  has_diabetes: z.boolean().default(false),
  has_heart_disease: z.boolean().default(false),
  has_bleeding_disorder: z.boolean().default(false),
  clinical_notes: trimmedOptional,

  chief_complaint: trimmedOptional,
  referral_source: trimmedOptional,
  preferred_dentist_id: z
    .string()
    .optional()
    .transform((value) => (value ? value : undefined)),
  insurance_provider: trimmedOptional,
  insurance_policy_number: trimmedOptional,
});

export type PatientFormValues = z.infer<typeof patientFormSchema>;

function splitTags(value: FormDataEntryValue | null): string[] {
  if (typeof value !== "string" || !value.trim()) return [];
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function str(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === "string" ? value : undefined;
}

function bool(formData: FormData, key: string): boolean {
  return formData.get(key) === "on" || formData.get(key) === "true";
}

/** Parses a submitted patient form into the shape patientFormSchema expects. */
export function patientFormValuesFromFormData(formData: FormData) {
  return {
    first_name: str(formData, "first_name") ?? "",
    last_name: str(formData, "last_name") ?? "",
    date_of_birth: str(formData, "date_of_birth"),
    gender: str(formData, "gender"),
    phone: str(formData, "phone"),
    email: str(formData, "email"),
    address: str(formData, "address"),
    national_id: str(formData, "national_id"),
    occupation: str(formData, "occupation"),
    emergency_contact_name: str(formData, "emergency_contact_name"),
    emergency_contact_phone: str(formData, "emergency_contact_phone"),

    allergies: splitTags(formData.get("allergies")),
    current_medications: splitTags(formData.get("current_medications")),
    medical_conditions: splitTags(formData.get("medical_conditions")),
    is_pregnant: bool(formData, "is_pregnant"),
    is_smoker: bool(formData, "is_smoker"),
    has_hypertension: bool(formData, "has_hypertension"),
    has_diabetes: bool(formData, "has_diabetes"),
    has_heart_disease: bool(formData, "has_heart_disease"),
    has_bleeding_disorder: bool(formData, "has_bleeding_disorder"),
    clinical_notes: str(formData, "clinical_notes"),

    chief_complaint: str(formData, "chief_complaint"),
    referral_source: str(formData, "referral_source"),
    preferred_dentist_id: str(formData, "preferred_dentist_id"),
    insurance_provider: str(formData, "insurance_provider"),
    insurance_policy_number: str(formData, "insurance_policy_number"),
  };
}

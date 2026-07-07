export { initials } from "@/lib/utils";

/** Age in whole years as of today. Returns null for missing/future dates. */
export function calculateAge(dateOfBirth: string | null | undefined): number | null {
  if (!dateOfBirth) return null;

  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;

  const now = new Date();
  if (dob > now) return null;

  let age = now.getFullYear() - dob.getFullYear();
  const monthDiff = now.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) {
    age -= 1;
  }
  return age;
}

export function formatPatientName(patient: { first_name: string; last_name: string }) {
  return `${patient.first_name} ${patient.last_name}`.trim();
}

const GENDER_LABELS: Record<string, string> = {
  male: "Male",
  female: "Female",
  other: "Other",
  unspecified: "Prefer not to say",
};

export function genderLabel(gender: string | null | undefined): string {
  if (!gender) return "—";
  return GENDER_LABELS[gender] ?? gender;
}

const MEDICAL_FLAG_LABELS = {
  is_pregnant: "Pregnancy",
  is_smoker: "Smoking",
  has_hypertension: "Blood Pressure",
  has_diabetes: "Diabetes",
  has_heart_disease: "Heart Disease",
  has_bleeding_disorder: "Bleeding Disorder",
} as const;

export type MedicalFlagKey = keyof typeof MEDICAL_FLAG_LABELS;

export const MEDICAL_FLAG_KEYS = Object.keys(MEDICAL_FLAG_LABELS) as MedicalFlagKey[];

export function medicalFlagLabel(key: MedicalFlagKey) {
  return MEDICAL_FLAG_LABELS[key];
}

/** Storage path convention: {clinicId}/{patientId}/{timestamp}-{sanitized filename}. */
export function buildPatientFilePath(clinicId: string, patientId: string, fileName: string) {
  const safeName = fileName.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  return `${clinicId}/${patientId}/${Date.now()}-${safeName}`;
}

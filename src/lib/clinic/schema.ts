import { z } from "zod";
import { CLINIC_TIMEZONE_OPTIONS } from "@/lib/onboarding/schema";

const trimmedOptional = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined));

/** Clinic identity + regional settings — the same clinics columns onboarding's signUpClinic() already writes (0001_phase1_foundation.sql). No new fields, no second definition of "clinic settings". */
export const clinicUpdateFormSchema = z.object({
  name: z.string().trim().min(1, "Enter the clinic's name").max(120, "Keep it under 120 characters"),
  phone: trimmedOptional,
  address: trimmedOptional,
  timezone: z.enum(CLINIC_TIMEZONE_OPTIONS, "Choose a timezone"),
});

export type ClinicUpdateFormValues = z.infer<typeof clinicUpdateFormSchema>;

function str(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === "string" ? value : undefined;
}

export function clinicUpdateFormValuesFromFormData(formData: FormData) {
  return {
    name: str(formData, "name") ?? "",
    phone: str(formData, "phone"),
    address: str(formData, "address"),
    timezone: str(formData, "timezone") ?? "Africa/Cairo",
  };
}

// ---------------------------------------------------------------------------
// Logo storage — reuses the exact bucket/RLS convention patient-files already
// established (0001_phase1_foundation.sql): a path prefixed by clinic_id,
// storage RLS scoping writes to that same prefix. Unlike patient-files, this
// bucket is public (0035_clinic_admin.sql) — a clinic logo is branding, not
// PII, so `clinics.logo_url` can hold a plain public URL and be rendered
// anywhere with a plain <img>, no signed-URL refresh needed.
// ---------------------------------------------------------------------------

export const CLINIC_LOGOS_BUCKET = "clinic-logos";
export const MAX_CLINIC_LOGO_BYTES = 2 * 1024 * 1024;
export const ACCEPTED_CLINIC_LOGO_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"] as const;

function extensionFromFileName(fileName: string): string {
  const match = /\.([a-zA-Z0-9]+)$/.exec(fileName);
  return match ? match[1].toLowerCase() : "png";
}

/** Storage path convention: {clinicId}/logo-{timestamp}.{ext} — a fresh path per upload (not an overwrite of a fixed name) so the new logo's URL is guaranteed to differ from the old one, and browsers/CDNs never serve a stale cached image after a replace. */
export function buildClinicLogoStoragePath(clinicId: string, fileName: string): string {
  return `${clinicId}/logo-${Date.now()}.${extensionFromFileName(fileName)}`;
}

/** True if `path` lives under this clinic's own folder — defense-in-depth re-check (mirrors appointmentBelongsToPatient's role in treatment-plans/actions.ts) before a client-supplied storage path is trusted to become clinics.logo_url, on top of the storage RLS policy that already restricts uploads to this same prefix. */
export function isStoragePathForClinic(path: string, clinicId: string): boolean {
  return path.startsWith(`${clinicId}/`);
}

/**
 * Recovers the storage object path from a previously-saved public logo URL,
 * so the old file can be cleaned up after a replace/remove. Public bucket
 * URLs have the fixed shape `.../storage/v1/object/public/{bucket}/{path}` —
 * anything not matching that shape (null, a future non-Supabase URL, a
 * manually-edited value) safely returns null rather than guessing.
 */
export function extractClinicLogoStoragePath(logoUrl: string | null | undefined): string | null {
  if (!logoUrl) return null;
  const marker = `/object/public/${CLINIC_LOGOS_BUCKET}/`;
  const index = logoUrl.indexOf(marker);
  if (index === -1) return null;
  const path = logoUrl.slice(index + marker.length);
  return path ? decodeURIComponent(path) : null;
}

export interface ClinicLogoFileInfo {
  type: string;
  size: number;
}

export type ClinicLogoValidationError = "invalid_type" | "too_large";

/** Pure validation for a selected logo file — checked here (fast, no network) before ever attempting the upload, and re-derivable server-side from the same two fields if a mutation ever needed to double-check them. */
export function validateClinicLogoFile(file: ClinicLogoFileInfo): ClinicLogoValidationError | null {
  if (!(ACCEPTED_CLINIC_LOGO_TYPES as readonly string[]).includes(file.type)) return "invalid_type";
  if (file.size > MAX_CLINIC_LOGO_BYTES) return "too_large";
  return null;
}

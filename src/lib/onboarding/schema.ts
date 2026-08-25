import { z } from "zod";

const trimmedOptional = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined));

/**
 * A small, curated set rather than every IANA zone — clinics.timezone
 * (0001_phase1_foundation.sql) accepts any text, but the sign-up form only
 * needs to cover this product's actual markets without turning into a
 * 400-option dropdown. Africa/Cairo stays first/default, matching the
 * column's own database default.
 */
export const CLINIC_TIMEZONE_OPTIONS = [
  "Africa/Cairo",
  "Asia/Riyadh",
  "Asia/Dubai",
  "Asia/Kuwait",
  "Europe/Istanbul",
  "Europe/London",
] as const;

export const signUpFormSchema = z
  .object({
    clinic_name: z.string().trim().min(1, "Enter your clinic's name").max(120, "Keep it under 120 characters"),
    address: trimmedOptional,
    timezone: z.enum(CLINIC_TIMEZONE_OPTIONS, "Choose a timezone"),
    full_name: z.string().trim().min(1, "Enter your name").max(100, "Keep it under 100 characters"),
    email: z
      .string()
      .trim()
      .min(1, "Enter your email")
      .email("Enter a valid email address")
      .max(150, "Keep it under 150 characters"),
    password: z.string().min(8, "Use at least 8 characters"),
    confirm_password: z.string().min(1, "Confirm your password"),
  })
  .refine((values) => values.password === values.confirm_password, {
    error: "Passwords don't match",
    path: ["confirm_password"],
  });

export type SignUpFormValues = z.infer<typeof signUpFormSchema>;

function str(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === "string" ? value : undefined;
}

export function signUpFormValuesFromFormData(formData: FormData) {
  return {
    clinic_name: str(formData, "clinic_name") ?? "",
    address: str(formData, "address"),
    timezone: str(formData, "timezone") ?? "Africa/Cairo",
    full_name: str(formData, "full_name") ?? "",
    email: str(formData, "email") ?? "",
    password: str(formData, "password") ?? "",
    confirm_password: str(formData, "confirm_password") ?? "",
  };
}

const SLUG_MAX_LENGTH = 60;
const COMBINING_MARK_RANGE_START = 0x0300;
const COMBINING_MARK_RANGE_END = 0x036f;

/** Drops Unicode combining diacritical marks left behind by NFKD normalization, e.g. the accent on "e-with-acute" once it's split apart from the base "e". Written as a code-point filter rather than a \u-range regex literal to avoid any ambiguity about which literal characters end up in this file. */
function stripCombiningMarks(value: string): string {
  return Array.from(value)
    .filter((char) => {
      const code = char.codePointAt(0) ?? 0;
      return code < COMBINING_MARK_RANGE_START || code > COMBINING_MARK_RANGE_END;
    })
    .join("");
}

/**
 * Pure slug generation from a clinic name for clinics.slug (unique,
 * 0001_phase1_foundation.sql) — lowercased, ASCII-hyphenated, deduplicated
 * against already-taken slugs by appending a numeric suffix. A name with no
 * ASCII-alphanumeric characters at all (e.g. purely Arabic) falls back to
 * "clinic" plus a suffix — the slug is only ever used as an internal unique
 * key, never shown to patients or staff, so this is an acceptable v1
 * limitation rather than a real product gap.
 */
export function generateClinicSlug(name: string, existingSlugs: readonly string[]): string {
  const base =
    stripCombiningMarks(name.trim().toLowerCase().normalize("NFKD"))
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, SLUG_MAX_LENGTH) || "clinic";

  const existing = new Set(existingSlugs);
  if (!existing.has(base)) return base;

  let suffix = 2;
  while (existing.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

/**
 * Clinic sign-up must only ever create the caller's first clinic — an
 * already-provisioned staff member (of any role, any clinic) hitting this
 * flow again should never be able to spin up a second clinic for
 * themselves. Pure predicate so the rule itself (not the session lookup)
 * is unit-testable.
 */
export function canSelfServeSignUp(existingStaff: { id: string } | null): boolean {
  return existingStaff === null;
}

export const MIN_PASSWORD_LENGTH = 8;

export type NewPasswordValidation = { ok: true } | { ok: false; reason: "too_short" | "mismatch" };

/** Pure client-side validation for PasswordChangeForm — kept separate from the Supabase Auth calls so the length/match rules are unit-testable without a browser client. */
export function validateNewPassword(password: string, confirmPassword: string): NewPasswordValidation {
  if (password.length < MIN_PASSWORD_LENGTH) return { ok: false, reason: "too_short" };
  if (password !== confirmPassword) return { ok: false, reason: "mismatch" };
  return { ok: true };
}

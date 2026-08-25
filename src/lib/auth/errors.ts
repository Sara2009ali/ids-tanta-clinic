/**
 * True if a Supabase Auth Admin API error indicates the email is already
 * registered — shared by every flow that creates or invites an auth.users
 * identity (doctors, staff, clinic sign-up), so "this email is already in
 * use" is detected the same way everywhere instead of drifting per module.
 */
export function isDuplicateAuthError(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  if (error.code === "email_exists") return true;
  return /already been registered|already exists/i.test(error.message ?? "");
}

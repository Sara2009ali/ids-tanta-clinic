import type { ZodError } from "zod";

/**
 * First error message per top-level field — used to populate a form's
 * fieldErrors map from a zod safeParse failure. Shared by every module that
 * validates a create/invite form this way (doctors, staff, onboarding)
 * instead of each defining its own copy.
 */
export function fieldErrorsFromZod(error: ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !fieldErrors[key]) {
      fieldErrors[key] = issue.message;
    }
  }
  return fieldErrors;
}

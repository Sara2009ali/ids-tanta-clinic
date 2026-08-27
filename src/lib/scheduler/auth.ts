/**
 * Scheduler trigger authentication — pure comparison logic, no env access
 * here (the route handler reads process.env.DENTRA_SCHEDULER_SECRET and
 * passes it in), so this is fully unit-testable without mocking the
 * environment. Deliberately unrelated to staff sessions/RLS: the scheduler
 * trigger is infrastructure-level execution authenticated by a single
 * shared secret, never a clinic_id, user id, or role.
 */

import { timingSafeEqual } from "node:crypto";

/**
 * Extracts the bearer token from an `Authorization: Bearer <secret>`
 * header — a header, never a query parameter, so the secret can't end up
 * logged in a URL, an access log, or browser history. Returns null for any
 * other shape (missing header, wrong scheme).
 */
export function extractBearerToken(authorizationHeader: string | null): string | null {
  if (!authorizationHeader) return null;
  const prefix = "Bearer ";
  if (!authorizationHeader.startsWith(prefix)) return null;
  const token = authorizationHeader.slice(prefix.length);
  return token.length > 0 ? token : null;
}

/**
 * Constant-time comparison against the configured secret. `timingSafeEqual`
 * throws if the two buffers differ in length, so a length mismatch is
 * checked and rejected first — this leaks the fact that lengths differ via
 * timing, but never leaks *which* character differs, which is the actual
 * property constant-time comparison exists to protect; matching this
 * codebase's own risk tolerance rather than inventing a padding scheme for
 * a secret whose length is not itself sensitive.
 */
export function isValidSchedulerSecret(provided: string | null, expected: string): boolean {
  if (!provided || !expected) return false;

  const providedBuffer = Buffer.from(provided, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  if (providedBuffer.length !== expectedBuffer.length) return false;

  return timingSafeEqual(providedBuffer, expectedBuffer);
}

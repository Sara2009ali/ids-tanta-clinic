import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.generated";

/**
 * Service-role Supabase client for the one thing the regular RLS-scoped
 * client structurally can't do: create/ban/unban auth.users rows (Doctors
 * Management's account provisioning). Same construction as
 * scripts/seed-auth-users.ts, adapted for use inside a server action —
 * built lazily per call rather than once at module scope, so a missing
 * SUPABASE_SECRET_KEY surfaces as a caught, user-facing action error
 * instead of crashing the whole server process at import time.
 *
 * SUPABASE_SECRET_KEY is deliberately absent from src/lib/env.ts (see that
 * file's own comment) — env.ts is parsed by client-bundled code too, and
 * this key must never reach the browser. This module is `server-only` and
 * reads process.env directly for that reason.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!url || !secretKey) {
    throw new Error(
      "SUPABASE_SECRET_KEY is not configured in this environment. Doctor account creation/access changes require it — set it alongside the existing NEXT_PUBLIC_SUPABASE_* variables.",
    );
  }

  return createSupabaseClient<Database>(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

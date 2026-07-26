"use server";

// TEMPORARY DIAGNOSTIC — remove this whole src/app/debug/auth/ directory
// (and the matching PUBLIC_PATHS entry in src/lib/supabase/proxy.ts) once
// the live login issue is diagnosed. Does not touch src/lib/auth/actions.ts
// or any real login flow — this is an isolated, read-only-except-for-its-
// own-immediate-cleanup diagnostic path.

import { createClient } from "@/lib/supabase/server";

function serializeSupabaseError(error: unknown) {
  if (!error || typeof error !== "object") return error ?? null;
  const e = error as Record<string, unknown>;
  return {
    name: e.name,
    message: e.message,
    status: e.status,
    code: e.code,
  };
}

export interface SignInDiagnosticResult {
  ran: boolean;
  reason?: string;
  succeeded?: boolean;
  hasSession?: boolean;
  hasUser?: boolean;
  error?: unknown;
}

/**
 * Runs the exact same supabase.auth.signInWithPassword() call the real
 * login action uses (same createClient() factory from
 * src/lib/supabase/server.ts), but returns the full result to the browser
 * instead of redirecting or collapsing the error into a generic message.
 * Immediately signs back out on success so this diagnostic page doesn't
 * leave a live session behind.
 */
export async function runSignInDiagnostic(email: string, password: string): Promise<SignInDiagnosticResult> {
  if (!email || !password) {
    return { ran: false, reason: "Enter an email and password first." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  const result: SignInDiagnosticResult = {
    ran: true,
    succeeded: !error,
    hasSession: !!data?.session,
    hasUser: !!data?.user,
    error: serializeSupabaseError(error),
  };

  if (!error) {
    await supabase.auth.signOut();
  }

  return result;
}

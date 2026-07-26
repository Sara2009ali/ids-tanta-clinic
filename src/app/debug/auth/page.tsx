// TEMPORARY DIAGNOSTIC PAGE — reachable without a session (see the
// matching PUBLIC_PATHS entry added to src/lib/supabase/proxy.ts).
// Remove this entire src/app/debug/auth/ directory, and revert that
// proxy.ts change, once the live login issue is diagnosed.

import { env } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { AuthDebugForm } from "@/app/debug/auth/auth-debug-form";

function extractProjectRef(url: string): string | null {
  const match = url.match(/^https?:\/\/([a-z0-9-]+)\.supabase\.co/i);
  return match ? match[1] : null;
}

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

export default async function DebugAuthPage() {
  const supabaseUrl = env.supabaseUrl;
  const projectRef = extractProjectRef(supabaseUrl);
  const keyPreview = env.supabasePublishableKey
    ? `${env.supabasePublishableKey.slice(0, 14)}… (${env.supabasePublishableKey.length} chars total)`
    : "(empty)";

  let createClientOk = true;
  let createClientError: string | null = null;
  let getSessionResult: { ok: boolean; hasSession: boolean; error: unknown } | null = null;
  let getUserResult: { ok: boolean; hasUser: boolean; error: unknown } | null = null;

  try {
    const supabase = await createClient();

    const sessionRes = await supabase.auth.getSession();
    getSessionResult = {
      ok: !sessionRes.error,
      hasSession: !!sessionRes.data.session,
      error: serializeSupabaseError(sessionRes.error),
    };

    const userRes = await supabase.auth.getUser();
    getUserResult = {
      ok: !userRes.error,
      hasUser: !!userRes.data.user,
      error: serializeSupabaseError(userRes.error),
    };
  } catch (e) {
    createClientOk = false;
    createClientError = e instanceof Error ? e.message : String(e);
  }

  return (
    <div style={{ fontFamily: "monospace", padding: 24, maxWidth: 800, margin: "0 auto", lineHeight: 1.5 }}>
      <h1 style={{ fontSize: 20 }}>/debug/auth — temporary diagnostic</h1>
      <p style={{ color: "#b00", fontWeight: "bold" }}>
        Remove this page (src/app/debug/auth/) and the /debug entry in src/lib/supabase/proxy.ts once done.
      </p>

      <h2 style={{ fontSize: 16, marginTop: 24 }}>NEXT_PUBLIC_SUPABASE_URL actually used by this deployment</h2>
      <pre style={{ background: "#f0f0f0", padding: 12 }}>{supabaseUrl}</pre>

      <h2 style={{ fontSize: 16, marginTop: 24 }}>Project reference extracted from it</h2>
      <pre style={{ background: "#f0f0f0", padding: 12 }}>{projectRef ?? "(could not extract — URL doesn't match the expected https://<ref>.supabase.co pattern)"}</pre>

      <h2 style={{ fontSize: 16, marginTop: 24 }}>Publishable key (preview only, not shown in full)</h2>
      <pre style={{ background: "#f0f0f0", padding: 12 }}>{keyPreview}</pre>

      <h2 style={{ fontSize: 16, marginTop: 24 }}>createClient()</h2>
      <pre style={{ background: "#f0f0f0", padding: 12 }}>
        {JSON.stringify({ succeeded: createClientOk, error: createClientError }, null, 2)}
      </pre>

      <h2 style={{ fontSize: 16, marginTop: 24 }}>auth.getSession()</h2>
      <pre style={{ background: "#f0f0f0", padding: 12 }}>{JSON.stringify(getSessionResult, null, 2)}</pre>

      <h2 style={{ fontSize: 16, marginTop: 24 }}>auth.getUser()</h2>
      <pre style={{ background: "#f0f0f0", padding: 12 }}>{JSON.stringify(getUserResult, null, 2)}</pre>

      <h2 style={{ fontSize: 16, marginTop: 24 }}>auth.signInWithPassword() — enter demo credentials to test</h2>
      <AuthDebugForm />
    </div>
  );
}

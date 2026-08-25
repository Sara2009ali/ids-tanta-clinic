import "server-only";

import { headers } from "next/headers";

/**
 * Best-effort absolute origin for the current request, used to build the
 * `redirectTo` URL for Supabase Auth invite emails (Staff invitations,
 * clinic sign-up doesn't need this). There's no NEXT_PUBLIC_SITE_URL in this
 * app (see lib/env.ts) — proxy.ts already trusts the Host header for
 * request routing, so reading it here carries the same trust level.
 */
export async function getAppOrigin(): Promise<string> {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "localhost:3000";
  const proto = headerList.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

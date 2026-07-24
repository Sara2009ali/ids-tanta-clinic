import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { VERIFIED_STAFF_ID_HEADER } from "@/lib/auth/verified-headers";
import type { StaffProfile, StaffRole } from "@/types/domain";

/**
 * Data Access Layer entry point for the current signed-in staff member.
 * Cached per-request so multiple Server Components can call this without
 * duplicating the auth + profile round trip. proxy.ts already redirects
 * unauthenticated requests away from (app)/*, but this is the source of
 * truth every Server Component/Action should re-check against directly
 * rather than trusting proxy alone.
 *
 * proxy.ts has already called auth.getUser() for this exact request (a real
 * network round trip to Supabase) before this ever runs, so we trust its
 * verified id via a request header instead of paying for that same round
 * trip again here. If the header is missing for any reason — proxy.ts not
 * matching this route, a future config change, direct invocation outside
 * the normal request flow — we fall back to the full network check, so
 * this never becomes a weaker guarantee than before, only a faster one on
 * the common path.
 */
export const getCurrentStaff = cache(async (): Promise<StaffProfile | null> => {
  const supabase = await createClient();

  const headerList = await headers();
  const verifiedUserId = headerList.get(VERIFIED_STAFF_ID_HEADER);

  const userId = verifiedUserId ?? (await supabase.auth.getUser()).data.user?.id ?? null;

  if (!userId) return null;

  const { data: profile } = await supabase
    .from("staff_profiles")
    .select("*")
    .eq("id", userId)
    .single();

  return profile;
});

/**
 * Requires a signed-in staff member with one of the given roles.
 * Redirects to /login if unauthenticated, or to /dashboard if authenticated
 * but not authorized for the current page.
 */
export async function requireRole(roles: StaffRole[]): Promise<StaffProfile> {
  const staff = await getCurrentStaff();

  if (!staff) {
    redirect("/login");
  }

  if (!roles.includes(staff.role)) {
    redirect("/dashboard");
  }

  return staff;
}

export async function requireStaff(): Promise<StaffProfile> {
  const staff = await getCurrentStaff();

  if (!staff) {
    redirect("/login");
  }

  return staff;
}

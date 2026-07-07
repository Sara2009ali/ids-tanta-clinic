import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { StaffProfile, StaffRole } from "@/types/domain";

/**
 * Data Access Layer entry point for the current signed-in staff member.
 * Cached per-request so multiple Server Components can call this without
 * duplicating the auth + profile round trip. proxy.ts already redirects
 * unauthenticated requests away from (app)/*, but this is the source of
 * truth every Server Component/Action should re-check against directly
 * rather than trusting proxy alone.
 */
export const getCurrentStaff = cache(async (): Promise<StaffProfile | null> => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("staff_profiles")
    .select("*")
    .eq("id", user.id)
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

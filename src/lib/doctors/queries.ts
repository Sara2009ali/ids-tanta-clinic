import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

function isBanned(bannedUntil: string | null | undefined): boolean {
  if (!bannedUntil) return false;
  return new Date(bannedUntil).getTime() > Date.now();
}

export interface DoctorForManagement {
  id: string;
  full_name: string;
  phone: string | null;
  is_active: boolean;
  specialty: string | null;
  license_number: string | null;
  color: string | null;
}

/**
 * Every doctor (active and deactivated) for the Doctors management list —
 * distinct from listDoctors() (patients/queries.ts), which stays exactly
 * as-is (active only) for booking/assignment dropdowns everywhere else.
 * Two plain queries merged in JS, matching getPatientById()'s treatment of
 * patient_clinical_info, rather than a nested embed — avoids depending on
 * PostgREST's one-to-one embed inference for a child-side PK/FK.
 */
export async function listDoctorsForManagement(): Promise<DoctorForManagement[]> {
  const supabase = await createClient();
  const [staffRes, profilesRes] = await Promise.all([
    supabase
      .from("staff_profiles")
      .select("id, full_name, phone, is_active")
      .eq("role", "doctor")
      .is("deleted_at", null)
      .order("full_name"),
    supabase.from("doctor_profiles").select("doctor_id, specialty, license_number, color"),
  ]);

  if (staffRes.error) {
    console.error("listDoctorsForManagement failed", staffRes.error);
    return [];
  }

  const profileById = new Map((profilesRes.data ?? []).map((profile) => [profile.doctor_id, profile]));

  return (staffRes.data ?? []).map((row) => {
    const profile = profileById.get(row.id);
    return {
      id: row.id,
      full_name: row.full_name,
      phone: row.phone,
      is_active: row.is_active,
      specialty: profile?.specialty ?? null,
      license_number: profile?.license_number ?? null,
      color: profile?.color ?? null,
    };
  });
}

export interface DoctorDetail {
  id: string;
  full_name: string;
  phone: string | null;
  is_active: boolean;
  specialty: string | null;
  license_number: string | null;
  bio: string | null;
  color: string;
  /** null when the account lookup itself failed (e.g. admin client unavailable) — distinct from "no email on file", which shouldn't happen for a doctor. */
  email: string | null;
  hasAccess: boolean;
}

/** One doctor's full profile, plus a live account lookup (email + access state) via the Admin API — there is no other way to read either off auth.users. */
export async function getDoctorDetail(id: string): Promise<DoctorDetail | null> {
  const supabase = await createClient();
  const [staffRes, profileRes] = await Promise.all([
    supabase
      .from("staff_profiles")
      .select("id, full_name, phone, is_active")
      .eq("id", id)
      .eq("role", "doctor")
      .is("deleted_at", null)
      .maybeSingle(),
    supabase.from("doctor_profiles").select("*").eq("doctor_id", id).maybeSingle(),
  ]);

  if (!staffRes.data) return null;

  let email: string | null = null;
  let hasAccess = false;
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.getUserById(id);
    if (error) throw error;
    if (data?.user) {
      email = data.user.email ?? null;
      hasAccess = !isBanned(data.user.banned_until);
    }
  } catch (error) {
    console.error("getDoctorDetail: account lookup failed", error);
  }

  return {
    id: staffRes.data.id,
    full_name: staffRes.data.full_name,
    phone: staffRes.data.phone,
    is_active: staffRes.data.is_active,
    specialty: profileRes.data?.specialty ?? null,
    license_number: profileRes.data?.license_number ?? null,
    bio: profileRes.data?.bio ?? null,
    color: profileRes.data?.color ?? "#6366f1",
    email,
    hasAccess,
  };
}

/**
 * Batched account-status lookup for the Doctors list, so the table doesn't
 * fire one Admin API call per row. listUsers() has no clinic scoping
 * (auth.users predates the clinics concept), so this pages through the
 * whole project and keeps only the ids this clinic's doctor list asked
 * about — fine at this app's current single/few-clinic scale.
 */
export async function getDoctorAccessMap(doctorIds: string[]): Promise<Map<string, boolean>> {
  const map = new Map<string, boolean>();
  if (doctorIds.length === 0) return map;

  const idSet = new Set(doctorIds);
  try {
    const admin = createAdminClient();
    const perPage = 200;
    let page = 1;

    for (;;) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
      if (error || !data || data.users.length === 0) break;

      for (const user of data.users) {
        if (idSet.has(user.id)) map.set(user.id, !isBanned(user.banned_until));
      }

      if (data.users.length < perPage || map.size === idSet.size) break;
      page += 1;
    }
  } catch (error) {
    console.error("getDoctorAccessMap failed", error);
  }

  return map;
}

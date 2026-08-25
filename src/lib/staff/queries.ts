import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { deriveStaffInvitationStatus, type StaffInvitationStatus } from "@/lib/staff/schema";
import type { StaffRole } from "@/types/domain";

export interface StaffForManagement {
  id: string;
  full_name: string;
  phone: string | null;
  role: StaffRole;
  is_active: boolean;
  email: string | null;
  status: StaffInvitationStatus;
}

/**
 * Every staff member in the clinic, across every role — including doctors,
 * so the roster reads as "everyone who works here" per the product brief,
 * even though doctors are added/edited from their own dedicated page.
 * Two plain queries merged in JS, same convention as listDoctorsForManagement.
 */
export async function listStaffForManagement(): Promise<StaffForManagement[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("staff_profiles")
    .select("id, full_name, phone, role, is_active")
    .is("deleted_at", null)
    .order("full_name");

  if (error) {
    console.error("listStaffForManagement failed", error);
    return [];
  }

  const rows = data ?? [];
  const accountById = await getStaffAccountMap(rows.map((row) => row.id));

  return rows.map((row) => {
    const account = accountById.get(row.id);
    return {
      id: row.id,
      full_name: row.full_name,
      phone: row.phone,
      role: row.role,
      is_active: row.is_active,
      email: account?.email ?? null,
      status: deriveStaffInvitationStatus({ isActive: row.is_active, lastSignInAt: account?.lastSignInAt ?? null }),
    };
  });
}

interface AccountInfo {
  email: string | null;
  lastSignInAt: string | null;
}

/**
 * Batched account-status lookup for the Staff list, same convention as
 * getDoctorAccessMap — one paged listUsers() pass rather than one Admin API
 * call per row.
 */
async function getStaffAccountMap(staffIds: string[]): Promise<Map<string, AccountInfo>> {
  const map = new Map<string, AccountInfo>();
  if (staffIds.length === 0) return map;

  const idSet = new Set(staffIds);
  try {
    const admin = createAdminClient();
    const perPage = 200;
    let page = 1;

    for (;;) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
      if (error || !data || data.users.length === 0) break;

      for (const user of data.users) {
        if (idSet.has(user.id)) {
          map.set(user.id, { email: user.email ?? null, lastSignInAt: user.last_sign_in_at ?? null });
        }
      }

      if (data.users.length < perPage || map.size === idSet.size) break;
      page += 1;
    }
  } catch (error) {
    console.error("getStaffAccountMap failed", error);
  }

  return map;
}

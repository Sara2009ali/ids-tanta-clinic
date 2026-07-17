"use server";

import { searchPatients } from "@/lib/patients/queries";
import { ensurePermission } from "@/lib/authz/session";
import { PERMISSIONS } from "@/lib/authz/permissions";
import type { PatientSearchRow } from "@/types/domain";

export interface PatientSearchActionResult {
  rows: PatientSearchRow[];
  totalCount: number;
}

/**
 * Thin "use server" wrapper around `searchPatients` (which has a
 * `server-only` import guard) so the client-side patient picker inside the
 * appointment sheet can call it directly via useTransition, the same way
 * server actions are called elsewhere in this app.
 */
export async function searchPatientsAction(query: string): Promise<PatientSearchActionResult> {
  const authz = await ensurePermission(PERMISSIONS.PATIENTS_VIEW);
  if (!authz.ok) {
    return { rows: [], totalCount: 0 };
  }

  const { rows, totalCount } = await searchPatients({ query: query || undefined, pageSize: 8 });
  return { rows, totalCount };
}

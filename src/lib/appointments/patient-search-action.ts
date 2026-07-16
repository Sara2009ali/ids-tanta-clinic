"use server";

import { searchPatients } from "@/lib/patients/queries";
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
  const { rows, totalCount } = await searchPatients({ query: query || undefined, pageSize: 8 });
  return { rows, totalCount };
}

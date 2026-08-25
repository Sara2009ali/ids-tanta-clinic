import "server-only";

import { createClient } from "@/lib/supabase/server";

export interface ClinicForSettings {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  timezone: string;
  logo_url: string | null;
}

/** The signed-in staff member's own clinic row — scoped by the existing "staff can read their own clinic" SELECT policy (0001_phase1_foundation.sql), no explicit clinic_id filter needed here any more than any other RLS-scoped read in this app. */
export async function getClinicForSettings(clinicId: string): Promise<ClinicForSettings | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clinics")
    .select("id, name, phone, address, timezone, logo_url")
    .eq("id", clinicId)
    .maybeSingle();

  if (error) {
    console.error("getClinicForSettings failed", error);
    return null;
  }
  return data;
}

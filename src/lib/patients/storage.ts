import "server-only";

import { createClient } from "@/lib/supabase/server";

const SIGNED_URL_TTL_SECONDS = 60 * 60;

/** Signed URL for a private patient-files object. Returns null on failure. */
export async function getPatientFileUrl(storagePath: string | null | undefined): Promise<string | null> {
  if (!storagePath) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from("patient-files")
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);

  if (error || !data) {
    console.error("getPatientFileUrl failed", error);
    return null;
  }

  return data.signedUrl;
}

/** Signs multiple storage paths in parallel, preserving order (null entries stay null). */
export async function getPatientFileUrls(
  storagePaths: (string | null | undefined)[],
): Promise<(string | null)[]> {
  return Promise.all(storagePaths.map((path) => getPatientFileUrl(path)));
}

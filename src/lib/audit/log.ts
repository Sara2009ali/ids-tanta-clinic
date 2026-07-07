import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.generated";

export interface AuditLogInput {
  clinicId: string;
  actorId: string;
  action: string;
  entityType: string;
  entityId?: string;
  changes?: Record<string, unknown>;
}

/**
 * Best-effort audit trail write. Failures are logged but never thrown —
 * an audit log outage should not block the underlying mutation from
 * succeeding for the user.
 */
export async function writeAuditLog(
  supabase: SupabaseClient<Database>,
  { clinicId, actorId, action, entityType, entityId, changes }: AuditLogInput,
) {
  const { error } = await supabase.from("audit_log").insert({
    clinic_id: clinicId,
    actor_id: actorId,
    action,
    entity_type: entityType,
    entity_id: entityId ?? null,
    changes: (changes as Database["public"]["Tables"]["audit_log"]["Insert"]["changes"]) ?? null,
  });

  if (error) {
    console.error("Failed to write audit log entry", { action, entityType, entityId, error });
  }
}

/**
 * Pure notification-event payload builders (Batch 6) — kept out of
 * service.ts (which has `import "server-only"` for its real RPC call) and
 * out of each module's own actions.ts, so "what does this notification say,
 * and should it fire at all" is unit-testable against hand-built fixtures,
 * the same calculations.ts/actions.ts split every other module in this
 * codebase already uses.
 */

import type { CreateNotificationInput } from "@/lib/notifications/service";

export interface RecallNotificationInput {
  clinicId: string;
  recallId: string;
  procedureName: string;
  dueDate: string;
  createdBy: string;
  recipientStaffIds: string[];
}

/** Builds the "a recall was auto-created" notification payload — entity_id/action_url point at the recall itself so a recipient can act on it directly from the notification. */
export function buildRecallCreatedNotification(input: RecallNotificationInput): CreateNotificationInput {
  return {
    clinicId: input.clinicId,
    source: "recalls.auto_created",
    type: "info",
    priority: "normal",
    title: "New recall created",
    body: `A follow-up recall was scheduled after a ${input.procedureName} treatment, due ${input.dueDate}.`,
    entityType: "recall",
    entityId: input.recallId,
    actionUrl: "/recalls",
    actionLabel: "View recalls",
    createdBy: input.createdBy,
    recipientStaffIds: input.recipientStaffIds,
  };
}

/**
 * Whether an automatic-recall notification should fire at all — only when
 * the recall insert genuinely created a new row (a truthy id was returned).
 * A conflict — recalls_treatment_record_id_unique already satisfied by an
 * earlier attempt for this same treatment record — means "do nothing," not
 * "notify again." This is the one decision point that makes notification
 * firing exactly as idempotent as the recall insert itself: the caller
 * never needs a second dedup mechanism.
 */
export function shouldNotifyForAutoRecall(insertedRecallId: string | null | undefined): boolean {
  return !!insertedRecallId;
}

export interface StaffInvitedNotificationInput {
  clinicId: string;
  staffId: string;
  fullName: string;
  role: string;
  createdBy: string;
  recipientStaffIds: string[];
}

/**
 * Builds the "a staff member was invited" notification — deliberately
 * carries only full_name/role/staffId, never the invite email, link, or any
 * token/secret: this is an internal event notice, not a substitute for (or
 * a leak of) the actual Supabase Auth invite email.
 */
export function buildStaffInvitedNotification(input: StaffInvitedNotificationInput): CreateNotificationInput {
  return {
    clinicId: input.clinicId,
    source: "staff.invited",
    type: "info",
    priority: "low",
    title: "New staff member invited",
    body: `${input.fullName} was invited to join as ${input.role}.`,
    entityType: "staff",
    entityId: input.staffId,
    actionUrl: "/settings/staff",
    actionLabel: "View staff",
    createdBy: input.createdBy,
    recipientStaffIds: input.recipientStaffIds,
  };
}

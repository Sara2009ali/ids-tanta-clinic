/**
 * Pure notification-event payload builders (Batch 6) — kept out of
 * service.ts (which has `import "server-only"` for its real RPC call) and
 * out of each module's own actions.ts, so "what does this notification say,
 * and should it fire at all" is unit-testable against hand-built fixtures,
 * the same calculations.ts/actions.ts split every other module in this
 * codebase already uses.
 */

import type { CreateNotificationInput } from "@/lib/notifications/service";
import { buildAppointmentReminderEventKey, type AppointmentReminderWindow } from "@/lib/appointments/reminders";

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

export interface AppointmentReminderNotificationInput {
  clinicId: string;
  appointmentId: string;
  window: AppointmentReminderWindow;
  patientName: string;
  scheduledStartLabel: string;
  recipientStaffIds: string[];
}

/**
 * Builds the "an appointment is coming up" reminder notification (Batch
 * 8). `eventKey` is always set — this event type is only ever created from
 * a scheduler job that can run repeatedly for the same tick or retry, so
 * it always needs the database-enforced dedup guarantee
 * (notifications.event_key, 0040_notification_event_key.sql), unlike
 * Batch 6's naturally one-shot events above. Staff-facing only: the
 * patient's own name is safe here (this is an internal clinic
 * notification, not anything sent to the patient), but no phone number or
 * clinical detail is included — only what's needed to identify which
 * appointment this is about.
 */
export function buildAppointmentReminderNotification(
  input: AppointmentReminderNotificationInput,
): CreateNotificationInput {
  return {
    clinicId: input.clinicId,
    source: "appointments.reminder",
    type: "info",
    priority: "normal",
    title: "Upcoming appointment reminder",
    body: `${input.patientName} has an appointment on ${input.scheduledStartLabel}.`,
    entityType: "appointment",
    entityId: input.appointmentId,
    actionUrl: "/appointments",
    actionLabel: "View appointments",
    recipientStaffIds: input.recipientStaffIds,
    eventKey: buildAppointmentReminderEventKey(input.appointmentId, input.window),
  };
}

export interface LowStockNotificationInput {
  clinicId: string;
  productId: string;
  productName: string;
  stockLevel: number;
  reorderThreshold: number;
  recipientStaffIds: string[];
}

/**
 * Builds the "product is at or below its reorder threshold" notification.
 * No event_key here — deliberately different from the reminder above:
 * duplicate suppression for this event is handled by the edge-triggered
 * inventory_low_stock_alerts state table (see inventory/low-stock.ts),
 * not a point-in-time event key, since the same underlying condition can
 * legitimately still be true on the next scheduler run without that being
 * a new "event."
 */
export function buildLowStockNotification(input: LowStockNotificationInput): CreateNotificationInput {
  return {
    clinicId: input.clinicId,
    source: "inventory.low_stock",
    type: "warning",
    priority: "normal",
    title: "Low stock",
    body: `${input.productName} is at ${input.stockLevel}, at or below its reorder threshold of ${input.reorderThreshold}.`,
    entityType: "inventory_product",
    entityId: input.productId,
    actionUrl: "/inventory/products",
    actionLabel: "View inventory",
    recipientStaffIds: input.recipientStaffIds,
  };
}

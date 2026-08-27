import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification, getStaffIdsWithPermission } from "@/lib/notifications/service";
import { buildAppointmentReminderNotification } from "@/lib/notifications/events";
import { isAppointmentReminderEligible, APPOINTMENT_REMINDER_WINDOW } from "@/lib/appointments/reminders";
import { PERMISSIONS } from "@/lib/authz/permissions";
import type { SchedulerJobResult } from "@/lib/scheduler/registry";

/**
 * Bounds the SQL query only — the real eligibility decision (is this
 * appointment happening "tomorrow" in ITS clinic's own timezone) is made
 * per-row in JS via isAppointmentReminderEligible(), since that needs a
 * per-clinic timezone conversion SQL can't easily express. 48 hours is
 * comfortably wide enough to contain "tomorrow" for every timezone offset
 * that exists (the widest is +/-14h from UTC) without fetching every
 * future appointment in the clinic's whole calendar.
 */
const LOOKAHEAD_HOURS = 48;

interface AppointmentReminderQueryRow {
  id: string;
  clinic_id: string;
  patient_id: string;
  doctor_id: string;
  status: string;
  scheduled_start: string;
  deleted_at: string | null;
  patients: { full_name: string } | null;
  clinics: { timezone: string } | null;
}

/**
 * Runs via the service-role admin client, not the RLS-scoped one — a
 * cron-triggered request has no staff session and therefore no single
 * clinic_id to be scoped by (see lib/supabase/admin.ts's own doc comment
 * and the Batch 7 scheduler foundation). Every clinic's appointments are
 * read in one query and then handled independently: recipient resolution
 * and the notification itself are always scoped to the row's own
 * clinic_id, read from the database, never assumed or supplied externally
 * — this is what "jobs must derive clinic scope themselves" means in
 * practice for a job that legitimately spans every clinic.
 */
export async function runAppointmentRemindersJob(): Promise<SchedulerJobResult> {
  const admin = createAdminClient();
  const now = new Date();
  const windowEnd = new Date(now.getTime() + LOOKAHEAD_HOURS * 60 * 60 * 1000);

  const { data, error } = await admin
    .from("appointments")
    .select("id, clinic_id, patient_id, doctor_id, status, scheduled_start, deleted_at, patients(full_name), clinics(timezone)")
    .is("deleted_at", null)
    .gte("scheduled_start", now.toISOString())
    .lt("scheduled_start", windowEnd.toISOString());

  if (error) {
    return { ok: false, message: `Failed to load appointments: ${error.message}` };
  }

  const rows = (data ?? []) as unknown as AppointmentReminderQueryRow[];
  let sent = 0;
  let skipped = 0;

  for (const row of rows) {
    const clinicTimezone = row.clinics?.timezone;
    if (!clinicTimezone) {
      // No safe way to evaluate "tomorrow" for this row without a clinic
      // timezone — skip rather than guess with the server's own timezone.
      skipped++;
      continue;
    }

    const scheduledStart = new Date(row.scheduled_start);
    const eligible = isAppointmentReminderEligible(
      {
        id: row.id,
        clinicId: row.clinic_id,
        patientId: row.patient_id,
        doctorId: row.doctor_id,
        status: row.status,
        scheduledStart,
        deletedAt: row.deleted_at,
      },
      now,
      clinicTimezone,
    );

    if (!eligible) continue;

    const recipientStaffIds = await getStaffIdsWithPermission(admin, row.clinic_id, PERMISSIONS.APPOINTMENTS_VIEW);
    const scheduledStartLabel = new Intl.DateTimeFormat("en-US", {
      timeZone: clinicTimezone,
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(scheduledStart);

    const notificationId = await createNotification(
      admin,
      buildAppointmentReminderNotification({
        clinicId: row.clinic_id,
        appointmentId: row.id,
        window: APPOINTMENT_REMINDER_WINDOW,
        patientName: row.patients?.full_name ?? "A patient",
        scheduledStartLabel,
        recipientStaffIds,
      }),
    );

    if (notificationId) sent++;
    else skipped++; // Either a duplicate (event_key conflict — already reminded) or no eligible recipients.
  }

  return { ok: true, message: `appointment_reminders: sent ${sent}, skipped ${skipped}` };
}

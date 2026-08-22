import Link from "next/link";
import { Suspense } from "react";
import { Armchair, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AppointmentFormSheet } from "@/components/appointments/appointment-form-sheet";
import { AppointmentRowActions } from "@/components/appointments/appointment-row-actions";
import { CalendarNav } from "@/components/appointments/calendar-nav";
import { CalendarViewSwitcher } from "@/components/appointments/calendar-view-switcher";
import { MonthView } from "@/components/appointments/month-view";
import { TodaysSchedule } from "@/components/appointments/todays-schedule";
import { WeekView } from "@/components/appointments/week-view";
import { getCurrentPermissions, requirePermission } from "@/lib/authz/session";
import { hasPermission, PERMISSIONS } from "@/lib/authz/permissions";
import {
  formatViewLabel,
  getViewRange,
  parseDateParam,
  type CalendarView,
} from "@/lib/appointments/calendar-dates";
import { getScheduleForRange, listChairs, listVisitTypes } from "@/lib/appointments/queries";
import { getTreatmentRecordsForAppointments } from "@/lib/treatments/queries";
import { getInvoiceIdsByAppointmentId } from "@/lib/billing/queries";
import { listDoctors, type DoctorOption } from "@/lib/patients/queries";
import { getLocale, getDictionary } from "@/lib/i18n/server";
import { typography } from "@/lib/typography";
import type { Dictionary } from "@/lib/i18n/types";
import type { Chair, TreatmentRecord, VisitType } from "@/types/domain";

const VIEWS = new Set<CalendarView>(["day", "week", "month"]);

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * The schedule query (joined across appointments/patients/staff/chairs/visit
 * types for the whole view range) gets its own Suspense boundary so the
 * header, nav, and view switcher — gated only on the small catalog queries
 * (doctors/chairs/visit types/permissions) — can paint first instead of
 * waiting on the heavier calendar query.
 *
 * Only the "day" view gets per-row actions (Check in/Complete/Edit/Cancel/
 * Create-or-View-Invoice, via the same AppointmentRowActions Reception
 * already uses) — week/month render appointments as small grid chips with
 * no existing interactivity at all, and wiring a dropdown into those would
 * be a much bigger UX change than "add the invoice action" calls for, plus
 * exactly the visual density this feature is meant to avoid. The two extra
 * lookups below (treatment records, existing-invoice ids) are therefore
 * also day-view-only, so switching to week/month never pays for them.
 */
async function CalendarBody({
  view,
  start,
  end,
  anchor,
  doctors,
  chairs,
  visitTypes,
  permissions,
  dict,
}: {
  view: CalendarView;
  start: Date;
  end: Date;
  anchor: Date;
  doctors: DoctorOption[];
  chairs: Chair[];
  visitTypes: VisitType[];
  permissions: string[];
  dict: Dictionary["appointments"];
}) {
  const rows = await getScheduleForRange(start.toISOString(), end.toISOString());
  const weekdayLabels = [dict.weekdays.sun, dict.weekdays.mon, dict.weekdays.tue, dict.weekdays.wed, dict.weekdays.thu, dict.weekdays.fri, dict.weekdays.sat];

  if (view === "week") return <WeekView rows={rows} start={start} emptyDayLabel={dict.noAppointmentsShort} />;
  if (view === "month") return <MonthView rows={rows} start={start} anchor={anchor} weekdayLabels={weekdayLabels} />;

  const appointmentIds = rows.map((row) => row.id);
  const canViewClinical = hasPermission(permissions, PERMISSIONS.CLINICAL_VIEW);
  const canEditBilling = hasPermission(permissions, PERMISSIONS.BILLING_EDIT);
  const [treatmentRecordsMap, invoiceIdMap] = await Promise.all([
    canViewClinical ? getTreatmentRecordsForAppointments(appointmentIds) : Promise.resolve(new Map<string, TreatmentRecord[]>()),
    canEditBilling ? getInvoiceIdsByAppointmentId(appointmentIds) : Promise.resolve(new Map<string, string>()),
  ]);
  const treatmentRecordsByAppointmentId = Object.fromEntries(treatmentRecordsMap);
  const invoiceIdByAppointmentId = Object.fromEntries(invoiceIdMap);

  return (
    <TodaysSchedule
      rows={rows}
      emptyMessage={dict.noAppointmentsDay}
      doctorPrefix={dict.doctorPrefix}
      emergencyLabel={dict.emergencyBadge}
      urgentLabel={dict.urgentBadge}
      highPriorityLabel={dict.highPriorityBadge}
      renderActions={(row) => (
        <AppointmentRowActions
          appointment={row}
          doctors={doctors}
          chairs={chairs}
          visitTypes={visitTypes}
          treatmentRecords={treatmentRecordsByAppointmentId[row.id] ?? []}
          invoiceId={invoiceIdByAppointmentId[row.id] ?? null}
          permissions={permissions}
        />
      )}
    />
  );
}

function CalendarBodySkeleton() {
  return (
    <div className="grid flex-1 grid-cols-7 gap-2">
      {Array.from({ length: 7 }).map((_, i) => (
        <Skeleton key={i} className="h-96 w-full rounded-xl" />
      ))}
    </div>
  );
}

export default async function AppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission(PERMISSIONS.APPOINTMENTS_VIEW);

  const sp = await searchParams;
  const viewRaw = firstParam(sp.view) ?? "week";
  const view = VIEWS.has(viewRaw as CalendarView) ? (viewRaw as CalendarView) : "week";
  const anchor = parseDateParam(firstParam(sp.date));
  const { start, end } = getViewRange(view, anchor);

  const [doctors, chairs, visitTypes, permissions, locale] = await Promise.all([
    listDoctors(),
    listChairs(),
    listVisitTypes(),
    getCurrentPermissions(),
    getLocale(),
  ]);
  const dict = getDictionary(locale).appointments;

  const canCreateAppointment = hasPermission(permissions, PERMISSIONS.APPOINTMENTS_CREATE);
  const canManageSchedules = hasPermission(permissions, PERMISSIONS.SETTINGS_MANAGE);

  return (
    <div className="flex h-full flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className={typography.pageTitle}>{dict.pageTitle}</h1>
          <p className="text-sm text-muted-foreground">{formatViewLabel(view, anchor)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canManageSchedules && (
            <Button variant="outline" render={<Link href="/appointments/doctor-schedule" />}>
              <CalendarClock className="size-4" />
              {dict.doctorSchedulesLink}
            </Button>
          )}
          {canManageSchedules && (
            <Button variant="outline" render={<Link href="/appointments/chairs" />}>
              <Armchair className="size-4" />
              {dict.chairsLink}
            </Button>
          )}
          {canCreateAppointment && (
            <AppointmentFormSheet doctors={doctors} chairs={chairs} visitTypes={visitTypes} />
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <CalendarNav view={view} anchor={anchor} previousLabel={dict.previous} todayLabel={dict.today} nextLabel={dict.next} />
        <CalendarViewSwitcher
          view={view}
          anchor={anchor}
          viewLabels={{ day: dict.viewDay, week: dict.viewWeek, month: dict.viewMonth }}
        />
      </div>

      <Suspense fallback={<CalendarBodySkeleton />}>
        <CalendarBody
          view={view}
          start={start}
          end={end}
          anchor={anchor}
          doctors={doctors}
          chairs={chairs}
          visitTypes={visitTypes}
          permissions={permissions}
          dict={dict}
        />
      </Suspense>
    </div>
  );
}

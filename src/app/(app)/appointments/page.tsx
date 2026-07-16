import { AppointmentFormSheet } from "@/components/appointments/appointment-form-sheet";
import { CalendarNav } from "@/components/appointments/calendar-nav";
import { CalendarViewSwitcher } from "@/components/appointments/calendar-view-switcher";
import { MonthView } from "@/components/appointments/month-view";
import { TodaysSchedule } from "@/components/appointments/todays-schedule";
import { WeekView } from "@/components/appointments/week-view";
import { getCurrentPermissions } from "@/lib/authz/session";
import { hasPermission, PERMISSIONS } from "@/lib/authz/permissions";
import {
  formatViewLabel,
  getViewRange,
  parseDateParam,
  type CalendarView,
} from "@/lib/appointments/calendar-dates";
import { getScheduleForRange, listChairs, listVisitTypes } from "@/lib/appointments/queries";
import { listDoctors } from "@/lib/patients/queries";

const VIEWS = new Set<CalendarView>(["day", "week", "month"]);

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const viewRaw = firstParam(sp.view) ?? "week";
  const view = VIEWS.has(viewRaw as CalendarView) ? (viewRaw as CalendarView) : "week";
  const anchor = parseDateParam(firstParam(sp.date));
  const { start, end } = getViewRange(view, anchor);

  const [rows, doctors, chairs, visitTypes, permissions] = await Promise.all([
    getScheduleForRange(start.toISOString(), end.toISOString()),
    listDoctors(),
    listChairs(),
    listVisitTypes(),
    getCurrentPermissions(),
  ]);

  const canCreateAppointment = hasPermission(permissions, PERMISSIONS.APPOINTMENTS_CREATE);

  return (
    <div className="flex h-full flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Appointments</h1>
          <p className="text-sm text-muted-foreground">{formatViewLabel(view, anchor)}</p>
        </div>
        {canCreateAppointment && (
          <AppointmentFormSheet doctors={doctors} chairs={chairs} visitTypes={visitTypes} />
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <CalendarNav view={view} anchor={anchor} />
        <CalendarViewSwitcher view={view} anchor={anchor} />
      </div>

      {view === "day" && <TodaysSchedule rows={rows} emptyMessage="No appointments scheduled for this day." />}
      {view === "week" && <WeekView rows={rows} start={start} />}
      {view === "month" && <MonthView rows={rows} start={start} anchor={anchor} />}
    </div>
  );
}

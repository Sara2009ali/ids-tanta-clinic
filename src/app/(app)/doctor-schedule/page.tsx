import Link from "next/link";
import { CalendarPlus, Settings2 } from "lucide-react";
import { AppointmentFormSheet } from "@/components/appointments/appointment-form-sheet";
import { DoctorScheduleDoctorSelect } from "@/components/appointments/doctor-schedule-doctor-select";
import { DoctorScheduleNav } from "@/components/appointments/doctor-schedule-nav";
import { DoctorScheduleViewSwitcher } from "@/components/appointments/doctor-schedule-view-switcher";
import { DoctorScheduleDayView } from "@/components/appointments/doctor-schedule-day-view";
import { DoctorScheduleWeekView } from "@/components/appointments/doctor-schedule-week-view";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { getCurrentPermissions, requirePermission } from "@/lib/authz/session";
import { hasPermission, PERMISSIONS } from "@/lib/authz/permissions";
import { getCurrentStaff } from "@/lib/auth/session";
import { getViewRange, parseDateParam, toDateParam, type CalendarView } from "@/lib/appointments/calendar-dates";
import { getDoctorScheduleInput, getScheduleForRange, listChairs, listVisitTypes } from "@/lib/appointments/queries";
import { describeDoctorAvailability } from "@/lib/appointments/validation";
import { listDoctors } from "@/lib/patients/queries";
import { getLocale, getDictionary } from "@/lib/i18n/server";
import { typography } from "@/lib/typography";

type DoctorScheduleView = Extract<CalendarView, "day" | "week">;
const VIEWS = new Set<DoctorScheduleView>(["day", "week"]);

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function DoctorSchedulePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Operational/planning view, not clinic configuration — same gate
  // /appointments itself uses (PERMISSIONS.APPOINTMENTS_VIEW), unlike the
  // Doctor Schedule *management* page under /appointments/doctor-schedule,
  // which is admin-only (SETTINGS_MANAGE) because it edits the underlying
  // working-hours/vacation/exception rows this page only reads.
  await requirePermission(PERMISSIONS.APPOINTMENTS_VIEW);

  const locale = await getLocale();
  const dict = getDictionary(locale).doctorSchedule;

  const [sp, staff, doctors, chairs, visitTypes, permissions] = await Promise.all([
    searchParams,
    getCurrentStaff(),
    listDoctors(),
    listChairs(),
    listVisitTypes(),
    getCurrentPermissions(),
  ]);
  const canManageSchedules = hasPermission(permissions, PERMISSIONS.SETTINGS_MANAGE);

  const requestedDoctorId = firstParam(sp.doctorId);
  const doctorId = doctors.some((doctor) => doctor.id === requestedDoctorId)
    ? requestedDoctorId
    // A signed-in doctor lands on their own schedule by default — anyone
    // else (reception, admin, ...) gets the clinic's first doctor, same
    // "pick something reasonable" fallback the admin config page uses.
    : (staff?.role === "doctor" && doctors.some((doctor) => doctor.id === staff.id) ? staff.id : doctors[0]?.id);

  const viewRaw = firstParam(sp.view);
  const view: DoctorScheduleView = VIEWS.has(viewRaw as DoctorScheduleView) ? (viewRaw as DoctorScheduleView) : "day";
  const anchor = parseDateParam(firstParam(sp.date));
  const { start, end } = getViewRange(view, anchor);

  const [scheduleRows, scheduleInput] = doctorId
    ? await Promise.all([getScheduleForRange(start.toISOString(), end.toISOString()), getDoctorScheduleInput(doctorId)])
    : [[], { weeklyHours: [], vacations: [], exceptions: [] }];

  const doctorRows = scheduleRows.filter((row) => row.doctor_id === doctorId);

  return (
    <div className="flex h-full flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className={typography.pageTitle}>{dict.pageTitle}</h1>
          <p className="text-sm text-muted-foreground">{dict.pageDescription}</p>
        </div>
        {doctorId && (
          <div className="flex flex-wrap items-center gap-2">
            {canManageSchedules && (
              <Button variant="outline" render={<Link href={`/appointments/doctor-schedule?doctorId=${doctorId}`} />}>
                <Settings2 className="size-4" />
                {dict.editWorkingHours}
              </Button>
            )}
            <AppointmentFormSheet
              doctors={doctors}
              chairs={chairs}
              visitTypes={visitTypes}
              defaultDoctorId={doctorId}
              defaultScheduledDate={toDateParam(anchor)}
            />
          </div>
        )}
      </div>

      <DoctorScheduleDoctorSelect doctors={doctors} selectedDoctorId={doctorId} view={view} date={toDateParam(anchor)} dict={dict} />

      {doctorId ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <DoctorScheduleNav doctorId={doctorId} view={view} anchor={anchor} dict={dict} />
            <DoctorScheduleViewSwitcher doctorId={doctorId} view={view} anchor={anchor} dict={dict} />
          </div>

          {view === "day" ? (
            <DoctorScheduleDayView
              rows={doctorRows}
              availability={describeDoctorAvailability(anchor.toISOString(), scheduleInput)}
              locale={locale}
              dict={dict}
            />
          ) : (
            <DoctorScheduleWeekView rows={doctorRows} start={start} schedule={scheduleInput} locale={locale} dict={dict} />
          )}
        </>
      ) : (
        <EmptyState icon={CalendarPlus} title={dict.noDoctors} />
      )}
    </div>
  );
}

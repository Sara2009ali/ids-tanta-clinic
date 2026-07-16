import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DoctorScheduleSelector } from "@/components/appointments/doctor-schedule-selector";
import { ExceptionsManager } from "@/components/appointments/exceptions-manager";
import { VacationsManager } from "@/components/appointments/vacations-manager";
import { WeeklyHoursEditor } from "@/components/appointments/weekly-hours-editor";
import { requirePermission } from "@/lib/authz/session";
import { PERMISSIONS } from "@/lib/authz/permissions";
import { listDoctors } from "@/lib/patients/queries";
import {
  listDoctorScheduleExceptions,
  listDoctorVacations,
  listDoctorWeeklyHours,
} from "@/lib/appointments/queries";

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function DoctorSchedulePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Hard-gated (redirects non-admins to /dashboard), unlike /appointments
  // itself — this is clinic configuration, not a view every clinic staff
  // member should reach.
  await requirePermission(PERMISSIONS.SETTINGS_MANAGE);

  const sp = await searchParams;
  const doctors = await listDoctors();
  const requestedDoctorId = firstParam(sp.doctorId);
  const doctorId = doctors.some((doctor) => doctor.id === requestedDoctorId)
    ? requestedDoctorId
    : doctors[0]?.id;

  const [weeklyHours, vacations, exceptions] = doctorId
    ? await Promise.all([
        listDoctorWeeklyHours(doctorId),
        listDoctorVacations(doctorId),
        listDoctorScheduleExceptions(doctorId),
      ])
    : [[], [], []];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="icon"
          render={<Link href="/appointments" aria-label="Back to appointments" />}
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Doctor Schedules</h1>
          <p className="text-sm text-muted-foreground">Weekly hours, vacations, and one-off exceptions.</p>
        </div>
      </div>

      <DoctorScheduleSelector doctors={doctors} selectedDoctorId={doctorId} />

      {doctorId ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Weekly hours</CardTitle>
            </CardHeader>
            <CardContent>
              <WeeklyHoursEditor doctorId={doctorId} weeklyHours={weeklyHours} />
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Vacations</CardTitle>
              </CardHeader>
              <CardContent>
                <VacationsManager doctorId={doctorId} vacations={vacations} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Exceptions</CardTitle>
              </CardHeader>
              <CardContent>
                <ExceptionsManager doctorId={doctorId} exceptions={exceptions} />
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
}

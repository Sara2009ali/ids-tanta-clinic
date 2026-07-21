import Link from "next/link";
import {
  Activity,
  CalendarDays,
  CheckCircle2,
  Clock,
  Search,
  UserPlus,
  Users,
  UserX,
  XCircle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { daysAgoIso } from "@/lib/utils";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AppointmentFormSheet } from "@/components/appointments/appointment-form-sheet";
import { TodaysSchedule } from "@/components/appointments/todays-schedule";
import { RecentActivityFeed } from "@/components/appointments/recent-activity-feed";
import {
  getDashboardCounts,
  getRecentActivity,
  getTodaysSchedule,
  listChairs,
  listVisitTypes,
} from "@/lib/appointments/queries";
import { listDoctors } from "@/lib/patients/queries";
import { getCurrentPermissions } from "@/lib/authz/session";
import { hasPermission, PERMISSIONS } from "@/lib/authz/permissions";
import { typography } from "@/lib/typography";

export default async function DashboardPage() {
  const supabase = await createClient();
  const sevenDaysAgo = daysAgoIso(7);

  const [
    { count: totalPatients },
    { count: newPatientsThisWeek },
    counts,
    schedule,
    activity,
    doctors,
    chairs,
    visitTypes,
    permissions,
  ] = await Promise.all([
    supabase.from("patients").select("*", { count: "exact", head: true }).eq("status", "active"),
    supabase
      .from("patients")
      .select("*", { count: "exact", head: true })
      .gte("created_at", sevenDaysAgo),
    getDashboardCounts(),
    getTodaysSchedule(),
    getRecentActivity(),
    listDoctors(),
    listChairs(),
    listVisitTypes(),
    getCurrentPermissions(),
  ]);

  const canCreateAppointment = hasPermission(permissions, PERMISSIONS.APPOINTMENTS_CREATE);
  const canCreatePatient = hasPermission(permissions, PERMISSIONS.PATIENTS_CREATE);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Here&apos;s what&apos;s happening at the clinic today.
        </p>
      </div>

      <div className="space-y-3">
        <h2 className={typography.eyebrow}>Today</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Today's Appointments" value={counts.todayTotal} icon={CalendarDays} />
          <StatCard label="Waiting Patients" value={counts.waiting} icon={Clock} />
          <StatCard label="In Treatment" value={counts.inTreatment} icon={Activity} />
          <StatCard label="Completed Today" value={counts.completedToday} icon={CheckCircle2} />
          <StatCard label="Cancelled Today" value={counts.cancelledToday} icon={XCircle} />
          <StatCard label="No Show Today" value={counts.noShowToday} icon={UserX} />
        </div>
      </div>

      <div className="space-y-3">
        <h2 className={typography.eyebrow}>Patients</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="New Patients Today" value={counts.newPatientsToday} icon={UserPlus} />
          <StatCard
            label="Active Patients"
            value={totalPatients ?? 0}
            icon={Users}
            hint={`${newPatientsThisWeek ?? 0} new in last 7 days`}
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Today&apos;s Schedule</CardTitle>
          </CardHeader>
          <CardContent>
            <TodaysSchedule rows={schedule} />
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {canCreateAppointment && (
                <AppointmentFormSheet
                  doctors={doctors}
                  chairs={chairs}
                  visitTypes={visitTypes}
                  className="w-full justify-start"
                />
              )}
              {canCreatePatient && (
                <Button variant="outline" className="w-full justify-start" render={<Link href="/patients/new" />}>
                  <UserPlus className="size-4" />
                  New Patient
                </Button>
              )}
              <Button variant="outline" className="w-full justify-start" render={<Link href="/patients" />}>
                <Search className="size-4" />
                Patient Search
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <RecentActivityFeed rows={activity} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

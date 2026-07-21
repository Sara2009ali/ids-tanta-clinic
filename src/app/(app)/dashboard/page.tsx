import Link from "next/link";
import {
  CalendarDays,
  Search,
  UserPlus,
  Users,
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
import { cn } from "@/lib/utils";

const TODAY_STATUS_BREAKDOWN: {
  key: "waiting" | "inTreatment" | "completedToday" | "cancelledToday" | "noShowToday";
  label: string;
  dot: string;
}[] = [
  { key: "waiting", label: "Waiting", dot: "bg-muted-foreground/40" },
  { key: "inTreatment", label: "In treatment", dot: "bg-primary" },
  { key: "completedToday", label: "Completed", dot: "bg-success" },
  { key: "cancelledToday", label: "Cancelled", dot: "bg-destructive/60" },
  { key: "noShowToday", label: "No-show", dot: "bg-destructive/60" },
];

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
    <div className="space-y-8">
      <div>
        <h1 className={typography.pageTitle}>Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Here&apos;s what&apos;s happening at the clinic today.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Hero stat: today's appointment total is the one number this page
            leads with — everything else is presented quieter and smaller,
            instead of eight equally-weighted boxes competing for attention. */}
        <Card className="lg:col-span-2">
          <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className={typography.eyebrow}>Today&apos;s appointments</p>
              <p className="mt-1 text-5xl font-semibold tracking-tight tabular-nums">{counts.todayTotal}</p>
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-2 sm:flex-col sm:items-end sm:gap-1.5">
              {TODAY_STATUS_BREAKDOWN.map(({ key, label, dot }) => (
                <div key={key} className="flex items-center gap-1.5 text-sm">
                  <span aria-hidden="true" className={cn("size-1.5 rounded-full", dot)} />
                  <span className="tabular-nums font-medium">{counts[key]}</span>
                  <span className="text-muted-foreground">{label}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <StatCard
          label="Active Patients"
          value={totalPatients ?? 0}
          icon={Users}
          hint={`${newPatientsThisWeek ?? 0} new in last 7 days · ${counts.newPatientsToday} today`}
        />
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
              <Button variant="outline" className="w-full justify-start" render={<Link href="/appointments" />}>
                <CalendarDays className="size-4" />
                View Calendar
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

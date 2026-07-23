import { Armchair, CalendarDays, CheckCircle2, Clock } from "lucide-react";
import { StatCard } from "@/components/dashboard/stat-card";
import { typography } from "@/lib/typography";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AppointmentFormSheet } from "@/components/appointments/appointment-form-sheet";
import { QuickPatientSearch } from "@/components/appointments/quick-patient-search";
import { ReceptionSchedule } from "@/components/appointments/reception-schedule";
import { RecentActivityFeed } from "@/components/appointments/recent-activity-feed";
import {
  getDashboardCounts,
  getRecentActivity,
  getTodaysSchedule,
  listChairs,
  listVisitTypes,
} from "@/lib/appointments/queries";
import { getTreatmentRecordsForAppointments } from "@/lib/treatments/queries";
import { listDoctors } from "@/lib/patients/queries";
import { getCurrentPermissions } from "@/lib/authz/session";
import { hasPermission, PERMISSIONS } from "@/lib/authz/permissions";
import type { TreatmentRecord } from "@/types/domain";

/**
 * The primary operational screen for front-desk staff. Deliberately built
 * on top of queries/actions/components that already exist elsewhere
 * (Reception Dashboard, the booking sheet, patient search, RecentActivityFeed)
 * rather than a new data layer — see docs/Phase-3A.md's "What Phase 3B can
 * build on top of this without schema changes" section, which anticipated
 * exactly this. A top-level route (not nested under /appointments) so its
 * Sidebar entry doesn't collide with "Appointments"'s prefix-based active
 * highlighting.
 */
export default async function ReceptionWorkspacePage() {
  const [counts, schedule, activity, doctors, chairs, visitTypes, permissions] = await Promise.all([
    getDashboardCounts(),
    getTodaysSchedule(),
    getRecentActivity(),
    listDoctors(),
    listChairs(),
    listVisitTypes(),
    getCurrentPermissions(),
  ]);

  const canCreateAppointment = hasPermission(permissions, PERMISSIONS.APPOINTMENTS_CREATE);
  const remainingToday = Math.max(
    0,
    counts.todayTotal - counts.completedToday - counts.cancelledToday - counts.noShowToday,
  );

  // Only fetched when the viewer can actually see it — clinical data has no
  // business being queried for a role that will never be shown it, same
  // discipline the Reports hub already applies to its own permission-gated
  // KPIs.
  const canViewClinical = hasPermission(permissions, PERMISSIONS.CLINICAL_VIEW);
  const treatmentRecordsMap = canViewClinical
    ? await getTreatmentRecordsForAppointments(schedule.map((row) => row.id))
    : new Map<string, TreatmentRecord[]>();
  const treatmentRecordsByAppointmentId = Object.fromEntries(treatmentRecordsMap);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className={typography.pageTitle}>Reception Workspace</h1>
          <p className="text-sm text-muted-foreground">Today&apos;s front-desk operations at a glance.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <QuickPatientSearch />
          {canCreateAppointment && (
            <AppointmentFormSheet doctors={doctors} chairs={chairs} visitTypes={visitTypes} />
          )}
        </div>
      </div>

      <div className="space-y-3">
        <h2 className={typography.eyebrow}>Today</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Today's Appointments" value={counts.todayTotal} icon={CalendarDays} />
          <StatCard label="Patients Checked In" value={counts.checkedIn} icon={CheckCircle2} />
          <StatCard label="Remaining Today" value={remainingToday} icon={Clock} />
          <StatCard label="Available Chairs" value={counts.availableChairsCount} icon={Armchair} />
        </div>
      </div>

      {/* Today's Schedule is the actual front-desk work happening right now —
          full width, same weight it gets on the Dashboard, rather than
          squeezed into two-thirds of the row next to a lighter-weight card. */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Today&apos;s Schedule</CardTitle>
        </CardHeader>
        <CardContent>
          <ReceptionSchedule
            rows={schedule}
            doctors={doctors}
            chairs={chairs}
            visitTypes={visitTypes}
            treatmentRecordsByAppointmentId={treatmentRecordsByAppointmentId}
            permissions={permissions}
          />
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
  );
}

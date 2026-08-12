import { Suspense } from "react";
import { Armchair, CalendarDays, CheckCircle2, Clock } from "lucide-react";
import { StatCard } from "@/components/dashboard/stat-card";
import { typography } from "@/lib/typography";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
import { getInvoiceIdsByAppointmentId } from "@/lib/billing/queries";
import { listDoctors, type DoctorOption } from "@/lib/patients/queries";
import { getCurrentPermissions } from "@/lib/authz/session";
import { hasPermission, PERMISSIONS } from "@/lib/authz/permissions";
import type { Chair, TreatmentRecord, VisitType } from "@/types/domain";

/**
 * Today's Schedule (which internally has a real 2-stage dependency —
 * treatment records depend on which appointment IDs the schedule query
 * returns) and Recent Activity each get their own Suspense boundary, same
 * pattern as the Dashboard, so the header/stat cards/quick actions above
 * them can paint as soon as the lighter `getDashboardCounts()` resolves
 * instead of waiting on this page's slowest query.
 */
async function ReceptionScheduleCard({
  doctors,
  chairs,
  visitTypes,
  permissions,
}: {
  doctors: DoctorOption[];
  chairs: Chair[];
  visitTypes: VisitType[];
  permissions: string[];
}) {
  const schedule = await getTodaysSchedule();
  const appointmentIds = schedule.map((row) => row.id);

  // Only fetched when the viewer can actually see it — clinical data has no
  // business being queried for a role that will never be shown it, same
  // discipline the Reports hub already applies to its own permission-gated
  // KPIs.
  const canViewClinical = hasPermission(permissions, PERMISSIONS.CLINICAL_VIEW);
  const canEditBilling = hasPermission(permissions, PERMISSIONS.BILLING_EDIT);
  const [treatmentRecordsMap, invoiceIdMap] = await Promise.all([
    canViewClinical ? getTreatmentRecordsForAppointments(appointmentIds) : Promise.resolve(new Map<string, TreatmentRecord[]>()),
    // Same reasoning: the Create Invoice / View Invoice action only shows
    // for billing.edit holders, so there's no point looking this up for
    // anyone else.
    canEditBilling ? getInvoiceIdsByAppointmentId(appointmentIds) : Promise.resolve(new Map<string, string>()),
  ]);
  const treatmentRecordsByAppointmentId = Object.fromEntries(treatmentRecordsMap);
  const invoiceIdByAppointmentId = Object.fromEntries(invoiceIdMap);

  return (
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
          invoiceIdByAppointmentId={invoiceIdByAppointmentId}
          permissions={permissions}
        />
      </CardContent>
    </Card>
  );
}

async function RecentActivityCard() {
  const activity = await getRecentActivity();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <RecentActivityFeed rows={activity} />
      </CardContent>
    </Card>
  );
}

function ReceptionCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-4 w-28" />
      </CardHeader>
      <CardContent className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-xl" />
        ))}
      </CardContent>
    </Card>
  );
}

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
  const [counts, doctors, chairs, visitTypes, permissions] = await Promise.all([
    getDashboardCounts(),
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
      <Suspense fallback={<ReceptionCardSkeleton />}>
        <ReceptionScheduleCard doctors={doctors} chairs={chairs} visitTypes={visitTypes} permissions={permissions} />
      </Suspense>

      <Suspense fallback={<ReceptionCardSkeleton />}>
        <RecentActivityCard />
      </Suspense>
    </div>
  );
}

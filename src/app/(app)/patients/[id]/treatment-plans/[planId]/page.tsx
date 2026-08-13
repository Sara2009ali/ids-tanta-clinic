import Link from "next/link";
import { notFound } from "next/navigation";
import { getTreatmentPlanDetail } from "@/lib/treatment-plans/queries";
import { getAppointmentsForPatient, listVisitTypes } from "@/lib/appointments/queries";
import { getCurrentPermissions, requirePermission } from "@/lib/authz/session";
import { hasPermission, PERMISSIONS } from "@/lib/authz/permissions";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { TreatmentPlanStatusBadge } from "@/components/treatment-plans/treatment-plan-status-badge";
import { TreatmentPlanActions } from "@/components/treatment-plans/treatment-plan-actions";
import { TreatmentPlanItemsList } from "@/components/treatment-plans/treatment-plan-items-list";
import { typography } from "@/lib/typography";
import type { TreatmentPlanStatus } from "@/types/domain";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default async function TreatmentPlanDetailPage({
  params,
}: {
  params: Promise<{ id: string; planId: string }>;
}) {
  await requirePermission(PERMISSIONS.CLINICAL_VIEW);

  const { id: patientId, planId } = await params;

  const [plan, visitTypes, appointments, permissions] = await Promise.all([
    getTreatmentPlanDetail(planId),
    listVisitTypes(),
    getAppointmentsForPatient(patientId),
    getCurrentPermissions(),
  ]);

  if (!plan || plan.patient_id !== patientId) {
    notFound();
  }

  const canEdit = hasPermission(permissions, PERMISSIONS.CLINICAL_EDIT);
  const title = plan.title || `Treatment Plan — ${formatDate(plan.created_at)}`;

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { label: "Patients", href: "/patients" },
          { label: plan.patientName, href: `/patients/${patientId}` },
          { label: title },
        ]}
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className={typography.pageTitle}>{title}</h1>
            <TreatmentPlanStatusBadge status={plan.status as TreatmentPlanStatus} />
          </div>
          <p className="text-sm text-muted-foreground">
            <Link href={`/patients/${patientId}`} className="hover:underline">
              {plan.patientName}
            </Link>
            {plan.patientNumber ? ` · #${plan.patientNumber}` : ""}
          </p>
          <p className="text-sm text-muted-foreground">Created {formatDate(plan.created_at)}</p>
        </div>
        <TreatmentPlanActions
          planId={plan.id}
          patientId={patientId}
          status={plan.status as TreatmentPlanStatus}
          canEdit={canEdit}
        />
      </div>

      <TreatmentPlanItemsList
        planId={plan.id}
        planStatus={plan.status as TreatmentPlanStatus}
        items={plan.items}
        visitTypes={visitTypes}
        appointments={appointments}
        canEdit={canEdit}
      />
    </div>
  );
}

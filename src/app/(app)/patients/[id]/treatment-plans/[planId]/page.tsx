import Link from "next/link";
import { notFound } from "next/navigation";
import { getTreatmentPlanDetail } from "@/lib/treatment-plans/queries";
import { computeEstimatedTotal } from "@/lib/treatment-plans/calculations";
import { getAppointmentsForPatient, listVisitTypes } from "@/lib/appointments/queries";
import { getPatientPriceContext } from "@/lib/pricing/queries";
import { resolveServicePrice } from "@/lib/pricing/resolve";
import { getCurrentPermissions, requirePermission } from "@/lib/authz/session";
import { hasPermission, PERMISSIONS } from "@/lib/authz/permissions";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { TreatmentPlanStatusBadge } from "@/components/treatment-plans/treatment-plan-status-badge";
import { TreatmentPlanActions } from "@/components/treatment-plans/treatment-plan-actions";
import { TreatmentPlanCreateInvoiceButton } from "@/components/treatment-plans/treatment-plan-create-invoice-button";
import { TreatmentPlanItemsList } from "@/components/treatment-plans/treatment-plan-items-list";
import { TreatmentPlanTitle } from "@/components/treatment-plans/treatment-plan-title";
import { TreatmentPlanProgressSummary } from "@/components/treatment-plans/treatment-plan-progress-summary";
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

  const [plan, visitTypes, appointments, permissions, priceContext] = await Promise.all([
    getTreatmentPlanDetail(planId),
    listVisitTypes(),
    getAppointmentsForPatient(patientId),
    getCurrentPermissions(),
    getPatientPriceContext(patientId),
  ]);

  if (!plan || plan.patient_id !== patientId) {
    notFound();
  }

  // Resolved once here (server-side — this patient is fixed for the whole
  // page, unlike Billing's dynamic patient picker) via the one price
  // resolution path, so both "Add procedure" and "Create Invoice" below see
  // this patient's actual prices, never the clinic's raw catalog price.
  const pricedVisitTypes = visitTypes.map((visitType) => ({
    ...visitType,
    price: resolveServicePrice({
      visitTypeId: visitType.id,
      basePrice: Number(visitType.price),
      priceListId: priceContext.priceListId,
      defaultPriceListId: priceContext.defaultPriceListId,
      overrides: priceContext.overrides,
    }),
  }));

  const canEdit = hasPermission(permissions, PERMISSIONS.CLINICAL_EDIT);
  // Existing billing.edit permission, unchanged — Create Invoice is only
  // offered to staff who could already create an invoice from Billing
  // directly. Today that's admin/super_admin (dentists have clinical.edit
  // but not billing.edit); see the discovery report's permission note for
  // the tradeoffs of widening this, which is a product decision, not made
  // here.
  const canBill = hasPermission(permissions, PERMISSIONS.BILLING_EDIT);
  const planStatus = plan.status as TreatmentPlanStatus;
  const title = plan.title || `Treatment Plan · ${formatDate(plan.created_at)}`;
  const estimatedTotal = computeEstimatedTotal(plan.items);

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
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <TreatmentPlanTitle planId={plan.id} title={plan.title} createdAt={plan.created_at} canEdit={canEdit} />
              <TreatmentPlanStatusBadge status={planStatus} />
            </div>
            <p className="text-sm text-muted-foreground">
              <Link href={`/patients/${patientId}`} className="hover:underline">
                {plan.patientName}
              </Link>
              {plan.patientNumber ? ` · #${plan.patientNumber}` : ""} · Created {formatDate(plan.created_at)}
            </p>
          </div>
          <TreatmentPlanProgressSummary items={plan.items} estimatedTotal={estimatedTotal} />
        </div>
        {/* Clinical plan actions lead; the financial action (Create Invoice)
            is visually separated after a divider rather than sitting
            undifferentiated among them — billing is a related but distinct
            responsibility from the plan's own clinical lifecycle, and
            shouldn't read as just one more plan-status button. Same
            separation pattern as PatientHeaderActions' destructive action. */}
        <div className="flex flex-wrap items-center gap-2">
          <TreatmentPlanActions
            planId={plan.id}
            patientId={patientId}
            status={planStatus}
            canEdit={canEdit}
          />
          {canBill && (
            // The divider only makes sense when a clinical action actually
            // rendered before it (canEdit — TreatmentPlanActions renders
            // nothing otherwise, e.g. an accountant with billing.edit but
            // not clinical.edit) — otherwise Create Invoice is the only
            // action here and shouldn't carry a leading rule with nothing
            // before it.
            <div className={canEdit ? "ms-1 border-s border-border ps-2" : undefined}>
              <TreatmentPlanCreateInvoiceButton
                patientId={patientId}
                patientName={plan.patientName}
                items={plan.items}
                visitTypes={pricedVisitTypes}
              />
            </div>
          )}
        </div>
      </div>

      <TreatmentPlanItemsList
        planId={plan.id}
        planStatus={plan.status as TreatmentPlanStatus}
        items={plan.items}
        visitTypes={pricedVisitTypes}
        appointments={appointments}
        canEdit={canEdit}
      />
    </div>
  );
}

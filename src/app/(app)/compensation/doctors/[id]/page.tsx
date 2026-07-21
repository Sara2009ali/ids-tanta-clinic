import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { DoctorCompensationPanel } from "@/components/compensation/doctor-compensation-panel";
import { RunSettlementSheet } from "@/components/compensation/run-settlement-sheet";
import {
  getCompensationRules,
  getDoctorEarnings,
  getDoctorEarningsSummary,
  getDoctorSettlements,
} from "@/lib/compensation/queries";
import { listDoctors } from "@/lib/patients/queries";
import { listVisitTypes } from "@/lib/appointments/queries";
import { getCurrentPermissions, requirePermission } from "@/lib/authz/session";
import { hasPermission, PERMISSIONS } from "@/lib/authz/permissions";

export default async function DoctorCompensationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission(PERMISSIONS.COMPENSATION_VIEW);

  const { id } = await params;

  const [doctors, summary, earnings, allRules, visitTypes, settlements, permissions] = await Promise.all([
    listDoctors(),
    getDoctorEarningsSummary(id),
    getDoctorEarnings({ doctorId: id }),
    // Bare, like the self-service view — RLS returns every clinic rule to an
    // admin (compensation.view), so filtering to "this doctor's own rows or
    // clinic-wide defaults" happens here in JS, same as compensation-rules-
    // filters.ts's clinic-wide handling. Passing { doctorId: id } would
    // incorrectly exclude the doctor_id-null clinic-wide rows.
    getCompensationRules(),
    listVisitTypes(),
    getDoctorSettlements(id),
    getCurrentPermissions(),
  ]);

  const doctor = doctors.find((d) => d.id === id);
  if (!doctor) {
    notFound();
  }

  const rules = allRules.filter((rule) => rule.doctor_id === id || rule.doctor_id === null);
  const canManage = hasPermission(permissions, PERMISSIONS.COMPENSATION_MANAGE);

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[{ label: "Compensation", href: "/compensation" }, { label: `Dr. ${doctor.full_name}` }]}
      />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dr. {doctor.full_name}</h1>
          <p className="text-sm text-muted-foreground">Earnings, rates, and settlement statements.</p>
        </div>
        {canManage && <RunSettlementSheet doctorId={doctor.id} doctorName={doctor.full_name} />}
      </div>

      <DoctorCompensationPanel
        summary={summary}
        earnings={earnings}
        rules={rules}
        visitTypes={visitTypes}
        settlements={settlements}
        doctorOptions={[doctor]}
        canManage={canManage}
      />
    </div>
  );
}

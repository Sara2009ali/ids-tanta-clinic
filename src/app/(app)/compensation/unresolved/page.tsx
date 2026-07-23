import Link from "next/link";
import { ArrowLeft, ArrowRight, Clock, FileWarning, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/dashboard/stat-card";
import { UnresolvedCompensationFilters } from "@/components/compensation/unresolved-compensation-filters";
import { UnresolvedCompensationTable, formatAge, type UnresolvedEntryRow } from "@/components/compensation/unresolved-compensation-table";
import type { UnresolvedCompensationQueryParams } from "@/components/compensation/unresolved-compensation-query-params";
import {
  getCompensationAuditEntries,
  getPaymentsByIds,
  getUnresolvedCompensationEntries,
} from "@/lib/compensation/queries";
import { listDoctors } from "@/lib/patients/queries";
import { listVisitTypes } from "@/lib/appointments/queries";
import { getCurrentPermissions, requirePermission } from "@/lib/authz/session";
import { hasPermission, PERMISSIONS } from "@/lib/authz/permissions";
import { typography } from "@/lib/typography";
import { cn } from "@/lib/utils";

// Generous heuristic, not a guarantee: enough rule_missing audit rows to
// cover every unresolved entry at this app's established scale. See the
// approved architecture review's Data Flow section for the tradeoff — a
// dedicated view/RPC would be exact, but isn't justified while unresolved
// lists (and this clinic's compensation audit volume) stay small.
const AUDIT_LOOKUP_LIMIT = 500;

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * The trigger that creates an 'unresolved' doctor_earnings row also writes a
 * 'compensation.rule_missing' audit_log row in the same transaction, with
 * entity_id = the payment's id and changes.visit_type_id already captured
 * (0014_doctor_compensation.sql). Reusing that existing audit trail is what
 * lets this page show a procedure name without a new invoice/appointment
 * join — the earning row's own compensation_rule_id is null by definition
 * for an unresolved entry, so there's no rule to look the procedure up
 * through the way the doctor self-service ledger (milestone 7) does.
 */
function buildVisitTypeIdByPaymentId(
  auditEntries: Awaited<ReturnType<typeof getCompensationAuditEntries>>,
): Map<string, string | null> {
  const map = new Map<string, string | null>();
  for (const audit of auditEntries) {
    if (audit.action !== "compensation.rule_missing") continue;
    if (!audit.entity_id) continue;
    const changes = audit.changes as Record<string, unknown> | null;
    const visitTypeId = changes && typeof changes.visit_type_id === "string" ? changes.visit_type_id : null;
    map.set(audit.entity_id, visitTypeId);
  }
  return map;
}

export default async function UnresolvedCompensationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission(PERMISSIONS.COMPENSATION_VIEW);

  const sp = await searchParams;
  const filterValue: UnresolvedCompensationQueryParams = {
    doctorId: firstParam(sp.doctorId) || undefined,
  };

  const [entries, doctors, visitTypes, auditEntries, permissions] = await Promise.all([
    getUnresolvedCompensationEntries(),
    listDoctors(),
    listVisitTypes(),
    getCompensationAuditEntries(AUDIT_LOOKUP_LIMIT),
    getCurrentPermissions(),
  ]);

  const canManage = hasPermission(permissions, PERMISSIONS.COMPENSATION_MANAGE);
  const payments = await getPaymentsByIds(entries.map((entry) => entry.payment_id));
  const amountByPaymentId = new Map(payments.map((payment) => [payment.id, Number(payment.amount)]));
  const visitTypeIdByPaymentId = buildVisitTypeIdByPaymentId(auditEntries);

  const allRows: UnresolvedEntryRow[] = entries.map((entry) => ({
    entry,
    visitTypeId: visitTypeIdByPaymentId.get(entry.payment_id) ?? null,
    paymentAmount: amountByPaymentId.get(entry.payment_id) ?? null,
  }));

  const hasFilters = Boolean(filterValue.doctorId);
  const filteredRows = filterValue.doctorId
    ? allRows.filter((row) => row.entry.doctor_id === filterValue.doctorId)
    : allRows;
  // Oldest first — this is a backlog to clear, not a recent-activity feed.
  const sortedRows = [...filteredRows].sort(
    (a, b) => new Date(a.entry.created_at).getTime() - new Date(b.entry.created_at).getTime(),
  );

  const distinctDoctorCount = new Set(entries.map((entry) => entry.doctor_id)).size;
  const oldestEntry = entries.length > 0 ? entries[entries.length - 1] : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Button variant="ghost" size="sm" render={<Link href="/compensation" />}>
            <ArrowLeft className="size-4" />
            Compensation
          </Button>
          <h1 className={cn("mt-1", typography.pageTitle)}>Unresolved Compensation</h1>
          <p className="text-sm text-muted-foreground">Payments recorded with no matching compensation rate.</p>
        </div>
        <Button variant="outline" render={<Link href="/compensation/rules" />}>
          Go to Rules
          <ArrowRight className="size-4" />
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Unresolved" value={entries.length} icon={FileWarning} />
        <StatCard label="Doctors Affected" value={distinctDoctorCount} icon={Users} />
        <StatCard
          label="Oldest Unresolved"
          value={oldestEntry ? formatAge(oldestEntry.created_at) : "—"}
          icon={Clock}
        />
      </div>

      <UnresolvedCompensationFilters value={filterValue} doctors={doctors} />

      <UnresolvedCompensationTable
        rows={sortedRows}
        doctors={doctors}
        visitTypes={visitTypes}
        canManage={canManage}
        hasFilters={hasFilters}
      />
    </div>
  );
}

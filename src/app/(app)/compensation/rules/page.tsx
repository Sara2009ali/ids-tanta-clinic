import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CompensationRulesFilters } from "@/components/compensation/compensation-rules-filters";
import { CompensationRulesTable } from "@/components/compensation/compensation-rules-table";
import { SetCompensationRuleSheet } from "@/components/compensation/set-compensation-rule-sheet";
import {
  DOCTOR_FILTER_CLINIC_WIDE,
  VISIT_TYPE_FILTER_ALL_PROCEDURES,
  type CompensationRulesQueryParams,
} from "@/components/compensation/compensation-rules-query-params";
import { getCompensationRules } from "@/lib/compensation/queries";
import { listDoctors, type DoctorOption } from "@/lib/patients/queries";
import { listVisitTypes } from "@/lib/appointments/queries";
import { getCurrentPermissions, requirePermission } from "@/lib/authz/session";
import { hasPermission, PERMISSIONS } from "@/lib/authz/permissions";
import type { CompensationRule, VisitType } from "@/types/domain";

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Filtering happens here, in memory, over the clinic's full (already
 * unmodified `getCompensationRules()`) rule set — no new query/RPC, matching
 * the "fetch broad, filter in JS" convention already accepted elsewhere in
 * this codebase at this app's established scale (e.g. getDoctorsPendingTotals).
 */
function filterRules(
  rules: CompensationRule[],
  doctors: DoctorOption[],
  visitTypes: VisitType[],
  params: CompensationRulesQueryParams,
): CompensationRule[] {
  const query = params.query?.trim().toLowerCase();

  return rules.filter((rule) => {
    if (params.doctorId === DOCTOR_FILTER_CLINIC_WIDE && rule.doctor_id !== null) return false;
    if (params.doctorId && params.doctorId !== DOCTOR_FILTER_CLINIC_WIDE && rule.doctor_id !== params.doctorId) {
      return false;
    }
    if (params.visitTypeId === VISIT_TYPE_FILTER_ALL_PROCEDURES && rule.visit_type_id !== null) return false;
    if (
      params.visitTypeId &&
      params.visitTypeId !== VISIT_TYPE_FILTER_ALL_PROCEDURES &&
      rule.visit_type_id !== params.visitTypeId
    ) {
      return false;
    }
    if (params.type && rule.type !== params.type) return false;

    if (query) {
      const doctorName = rule.doctor_id
        ? `dr. ${(doctors.find((d) => d.id === rule.doctor_id)?.full_name ?? "").toLowerCase()}`
        : "all doctors";
      const procedureName = rule.visit_type_id
        ? (visitTypes.find((v) => v.id === rule.visit_type_id)?.name ?? "").toLowerCase()
        : "all procedures";
      if (!doctorName.includes(query) && !procedureName.includes(query)) return false;
    }

    return true;
  });
}

export default async function CompensationRulesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission(PERMISSIONS.COMPENSATION_VIEW);

  const sp = await searchParams;
  const filterValue: CompensationRulesQueryParams = {
    query: firstParam(sp.query) || undefined,
    doctorId: firstParam(sp.doctorId) || undefined,
    visitTypeId: firstParam(sp.visitTypeId) || undefined,
    type: firstParam(sp.type) || undefined,
  };
  const hasFilters = Boolean(
    filterValue.query || filterValue.doctorId || filterValue.visitTypeId || filterValue.type,
  );

  const [rules, doctors, visitTypes, permissions] = await Promise.all([
    getCompensationRules(),
    listDoctors(),
    listVisitTypes(),
    getCurrentPermissions(),
  ]);

  const canManage = hasPermission(permissions, PERMISSIONS.COMPENSATION_MANAGE);
  const filteredRules = filterRules(rules, doctors, visitTypes, filterValue);
  const activeRules = filteredRules.filter((rule) => !rule.effective_to);
  const historyRules = filteredRules;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Button variant="ghost" size="sm" render={<Link href="/compensation" />}>
            <ArrowLeft className="size-4" />
            Compensation
          </Button>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Compensation Rules</h1>
          <p className="text-sm text-muted-foreground">What each doctor earns, per procedure.</p>
        </div>
        {canManage && <SetCompensationRuleSheet doctors={doctors} visitTypes={visitTypes} />}
      </div>

      <CompensationRulesFilters value={filterValue} doctors={doctors} visitTypes={visitTypes} />

      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="pt-6">
          <CompensationRulesTable
            rules={activeRules}
            doctors={doctors}
            visitTypes={visitTypes}
            canManage={canManage}
            mode="active"
            hasFilters={hasFilters}
          />
        </TabsContent>

        <TabsContent value="history" className="pt-6">
          <CompensationRulesTable
            rules={historyRules}
            doctors={doctors}
            visitTypes={visitTypes}
            canManage={canManage}
            mode="history"
            hasFilters={hasFilters}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

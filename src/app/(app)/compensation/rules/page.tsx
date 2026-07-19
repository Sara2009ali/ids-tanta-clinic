import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CompensationRulesTable } from "@/components/compensation/compensation-rules-table";
import { SetCompensationRuleSheet } from "@/components/compensation/set-compensation-rule-sheet";
import { getCompensationRules } from "@/lib/compensation/queries";
import { listDoctors } from "@/lib/patients/queries";
import { listVisitTypes } from "@/lib/appointments/queries";
import { getCurrentPermissions, requirePermission } from "@/lib/authz/session";
import { hasPermission, PERMISSIONS } from "@/lib/authz/permissions";

export default async function CompensationRulesPage() {
  await requirePermission(PERMISSIONS.COMPENSATION_VIEW);

  const [rules, doctors, visitTypes, permissions] = await Promise.all([
    getCompensationRules(),
    listDoctors(),
    listVisitTypes(),
    getCurrentPermissions(),
  ]);

  const canManage = hasPermission(permissions, PERMISSIONS.COMPENSATION_MANAGE);
  const activeRules = rules.filter((rule) => !rule.effective_to);
  const historyRules = rules;

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

      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="pt-6">
          <CompensationRulesTable rules={activeRules} doctors={doctors} visitTypes={visitTypes} canManage={canManage} mode="active" />
        </TabsContent>

        <TabsContent value="history" className="pt-6">
          <CompensationRulesTable
            rules={historyRules}
            doctors={doctors}
            visitTypes={visitTypes}
            canManage={canManage}
            mode="history"
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

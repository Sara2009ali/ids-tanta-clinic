import { FileWarning, HandCoins, Wallet } from "lucide-react";
import { StatCard } from "@/components/dashboard/stat-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CompensationRulesTable } from "@/components/compensation/compensation-rules-table";
import { MyCompensationEarningsTable } from "@/components/compensation/my-compensation-earnings-table";
import { MyStatementsTable } from "@/components/compensation/my-statements-table";
import { formatCurrency } from "@/lib/billing/format";
import type { DoctorEarningsSummary } from "@/lib/compensation/queries";
import type { DoctorOption } from "@/lib/patients/queries";
import type { CompensationRule, DoctorEarning, DoctorSettlement, VisitType } from "@/types/domain";

/**
 * One doctor's compensation — stat cards plus Pending/All Earnings/Rates/
 * Statements tabs. Shared by the dentist's own self-service view
 * (`/compensation`) and the admin drill-down (`/compensation/doctors/[id]`).
 * The two call sites differ only in how `earnings`/`rules` were scoped
 * upstream (RLS-implicit for self-service, explicit doctorId + clinic-wide
 * filtering for admin) and in whether `canManage` is ever true (only the
 * admin path can pass true) — this component just renders what it's given.
 */
export function DoctorCompensationPanel({
  summary,
  earnings,
  rules,
  visitTypes,
  settlements,
  doctorOptions,
  canManage,
}: {
  summary: DoctorEarningsSummary;
  earnings: DoctorEarning[];
  rules: CompensationRule[];
  visitTypes: VisitType[];
  settlements: DoctorSettlement[];
  doctorOptions: DoctorOption[];
  canManage: boolean;
}) {
  const pendingEarnings = earnings.filter((entry) => !entry.settlement_id);
  const activeRules = rules.filter((rule) => !rule.effective_to);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Pending" value={formatCurrency(summary.pendingTotal)} icon={Wallet} />
        <StatCard label="Settled (Lifetime)" value={formatCurrency(summary.settledTotal)} icon={HandCoins} />
        <StatCard label="Unresolved" value={summary.unresolvedCount} icon={FileWarning} />
      </div>

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="all">All Earnings</TabsTrigger>
          <TabsTrigger value="rates">Rates</TabsTrigger>
          <TabsTrigger value="statements">Statements</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="pt-6">
          <MyCompensationEarningsTable
            earnings={pendingEarnings}
            rules={rules}
            visitTypes={visitTypes}
            emptyMessage="No pending earnings right now."
          />
        </TabsContent>

        <TabsContent value="all" className="pt-6">
          <MyCompensationEarningsTable
            earnings={earnings}
            rules={rules}
            visitTypes={visitTypes}
            emptyMessage="No compensation activity yet."
          />
        </TabsContent>

        <TabsContent value="rates" className="pt-6">
          <Tabs defaultValue="active">
            <TabsList>
              <TabsTrigger value="active">Active</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>
            <TabsContent value="active" className="pt-6">
              <CompensationRulesTable
                rules={activeRules}
                doctors={doctorOptions}
                visitTypes={visitTypes}
                canManage={canManage}
                mode="active"
              />
            </TabsContent>
            <TabsContent value="history" className="pt-6">
              <CompensationRulesTable
                rules={rules}
                doctors={doctorOptions}
                visitTypes={visitTypes}
                canManage={canManage}
                mode="history"
              />
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="statements" className="pt-6">
          <MyStatementsTable settlements={settlements} earnings={earnings} rules={rules} visitTypes={visitTypes} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

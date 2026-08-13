import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { TreatmentPlanStatusBadge } from "@/components/treatment-plans/treatment-plan-status-badge";
import { NewTreatmentPlanDialog } from "@/components/treatment-plans/new-treatment-plan-dialog";
import type { TreatmentPlanListRow } from "@/lib/treatment-plans/queries";
import type { TreatmentPlanStatus } from "@/types/domain";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function planTitle(plan: TreatmentPlanListRow): string {
  return plan.title || `Treatment Plan — ${formatDate(plan.created_at)}`;
}

/** Compact, at-a-glance list — the full editing workspace lives on the dedicated detail page, not here (same two-tier split Patient Profile already uses for Invoices). */
export function TreatmentPlansList({
  patientId,
  plans,
  canEdit,
}: {
  patientId: string;
  plans: TreatmentPlanListRow[];
  canEdit: boolean;
}) {
  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="flex justify-end">
          <NewTreatmentPlanDialog patientId={patientId} />
        </div>
      )}

      {plans.length === 0 ? (
        <EmptyState
          title="No treatment plans yet."
          description="Create a plan to propose procedures for this patient."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Items</TableHead>
                <TableHead className="text-right">Accepted</TableHead>
                <TableHead className="text-right">Completed</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.map((plan) => (
                <TableRow key={plan.id}>
                  <TableCell className="font-medium">
                    <Link href={`/patients/${patientId}/treatment-plans/${plan.id}`} className="hover:underline">
                      {planTitle(plan)}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <TreatmentPlanStatusBadge status={plan.status as TreatmentPlanStatus} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{plan.itemCount}</TableCell>
                  <TableCell className="text-right tabular-nums">{plan.acceptedPercent}%</TableCell>
                  <TableCell className="text-right tabular-nums">{plan.completedPercent}%</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(plan.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

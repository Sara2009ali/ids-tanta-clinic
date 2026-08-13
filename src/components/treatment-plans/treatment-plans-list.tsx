import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { TreatmentPlanStatusBadge } from "@/components/treatment-plans/treatment-plan-status-badge";
import { NewTreatmentPlanButton } from "@/components/treatment-plans/new-treatment-plan-button";
import { formatCurrency } from "@/lib/billing/format";
import { typography } from "@/lib/typography";
import { cn } from "@/lib/utils";
import type { TreatmentPlanListRow } from "@/lib/treatment-plans/queries";
import type { TreatmentPlanStatus } from "@/types/domain";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function planTitle(plan: { title: string | null; created_at: string }): string {
  return plan.title || `Treatment Plan · ${formatDate(plan.created_at)}`;
}

/** Active plans surface first, then draft, then the historical (completed/abandoned) ones — so "which plan is current" never depends on scanning dates. Ties keep the query's own most-recent-first order. */
const STATUS_SORT_PRIORITY: Record<TreatmentPlanStatus, number> = { active: 0, draft: 1, completed: 2, abandoned: 3 };

function sortPlans(plans: TreatmentPlanListRow[]): TreatmentPlanListRow[] {
  return [...plans].sort(
    (a, b) => STATUS_SORT_PRIORITY[a.status as TreatmentPlanStatus] - STATUS_SORT_PRIORITY[b.status as TreatmentPlanStatus],
  );
}

function summaryLine(plan: TreatmentPlanListRow): string {
  const procedureWord = plan.itemCount === 1 ? "procedure" : "procedures";
  if (plan.itemCount === 0) return "No procedures yet";
  return `${plan.itemCount} ${procedureWord} · ${plan.acceptedCount} accepted · ${plan.completedCount} completed`;
}

/**
 * Compact, at-a-glance list — the full editing workspace lives on the
 * dedicated detail page, not here (same two-tier split Patient Profile
 * already uses for Invoices). Cards, not a table: a plan is a clinical
 * document with its own status and progress, not a row of comparable
 * columns, and cards stack cleanly on mobile instead of forcing a
 * horizontal-scrolling table.
 */
export function TreatmentPlansList({
  patientId,
  plans,
  canEdit,
}: {
  patientId: string;
  plans: TreatmentPlanListRow[];
  canEdit: boolean;
}) {
  if (plans.length === 0) {
    return (
      <EmptyState
        title="No treatment plans yet"
        description="Treatment Plans let you propose, sequence, and track procedures for this patient before anything is performed."
        action={canEdit ? <NewTreatmentPlanButton patientId={patientId} /> : undefined}
      />
    );
  }

  const sortedPlans = sortPlans(plans);

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="flex justify-end">
          <NewTreatmentPlanButton patientId={patientId} />
        </div>
      )}

      <div className="space-y-2">
        {sortedPlans.map((plan) => {
          const status = plan.status as TreatmentPlanStatus;
          return (
            <Link
              key={plan.id}
              href={`/patients/${patientId}/treatment-plans/${plan.id}`}
              className={cn(
                "flex items-center justify-between gap-4 rounded-xl border border-border p-4 transition-colors hover:bg-muted/40",
                status === "active" && "border-l-2 border-l-primary",
              )}
            >
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate font-medium">{planTitle(plan)}</p>
                  <TreatmentPlanStatusBadge status={status} />
                </div>
                <p className={typography.caption}>{summaryLine(plan)}</p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <div className="text-right">
                  {plan.estimatedTotal > 0 && (
                    <p className="text-sm font-medium tabular-nums">{formatCurrency(plan.estimatedTotal)}</p>
                  )}
                  <p className={typography.caption}>{formatDate(plan.created_at)}</p>
                </div>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

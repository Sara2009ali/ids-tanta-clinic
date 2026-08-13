import { computeItemProgress } from "@/lib/treatment-plans/calculations";
import { formatCurrency } from "@/lib/billing/format";
import { typography } from "@/lib/typography";

/**
 * Compact progress readout for the plan detail header — answers "what's the
 * estimated value" and "what's done" in one glance, without becoming a
 * generic analytics dashboard. The bar tracks completed-of-total; accepted
 * count is called out in text since "accepted but not yet done" is a
 * distinct, clinically meaningful state a single bar can't represent.
 */
export function TreatmentPlanProgressSummary({
  items,
  estimatedTotal,
}: {
  items: { status: string }[];
  estimatedTotal: number;
}) {
  const progress = computeItemProgress(items);

  if (progress.totalCount === 0) return null;

  const procedureWord = progress.totalCount === 1 ? "procedure" : "procedures";

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
      <div className="min-w-40 flex-1 space-y-1.5">
        <p className={typography.caption}>
          {progress.totalCount} {procedureWord} · {progress.acceptedCount} accepted · {progress.completedCount}{" "}
          completed
        </p>
        <div
          role="progressbar"
          aria-valuenow={progress.completedPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${progress.completedCount} of ${progress.totalCount} procedures completed`}
          className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
        >
          <div className="h-full rounded-full bg-success" style={{ width: `${progress.completedPercent}%` }} />
        </div>
      </div>
      {estimatedTotal > 0 && (
        <div>
          <p className={typography.caption}>Estimated value</p>
          <p className="font-heading text-lg font-medium tabular-nums">{formatCurrency(estimatedTotal)}</p>
        </div>
      )}
    </div>
  );
}

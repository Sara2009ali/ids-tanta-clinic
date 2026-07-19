import { formatCurrency } from "@/lib/billing/format";
import { COMPENSATION_RULE_TYPE_LABELS, type CompensationEntryType, type CompensationRuleType } from "@/types/domain";

interface RateSnapshot {
  rule_type: CompensationRuleType;
  rule_config: Record<string, number>;
  invoice_subtotal: number;
  payment_amount: number;
  computed_amount: number;
}

function isRateSnapshot(value: unknown): value is RateSnapshot {
  return !!value && typeof value === "object" && "rule_type" in value && "computed_amount" in value;
}

function describeRule(type: CompensationRuleType, config: Record<string, number>): string {
  if (type === "percentage") return `${config.rate ?? 0}% of the invoice subtotal`;
  if (type === "fixed") return `a fixed ${formatCurrency(config.amount ?? 0)} per invoice`;
  return `${formatCurrency(config.base_amount ?? 0)} plus ${config.rate ?? 0}% of the invoice subtotal`;
}

/**
 * Renders straight from a doctor_earnings row's own rate_snapshot (0014_doctor_compensation.sql)
 * rather than the current compensation_rules row — a rule can be replaced after the fact, but the
 * snapshot captured at write time is what actually produced this entry's amount, and never changes.
 */
export function RateSnapshotDisclosure({
  entryType,
  rateSnapshot,
}: {
  entryType: CompensationEntryType;
  rateSnapshot: unknown;
}) {
  if (entryType === "unresolved" || !isRateSnapshot(rateSnapshot)) {
    return (
      <p className="text-sm text-muted-foreground">
        No compensation rate was configured for this procedure at the time of payment. Contact an admin or accountant
        to have it resolved.
      </p>
    );
  }

  const { rule_type, rule_config, invoice_subtotal, payment_amount, computed_amount } = rateSnapshot;

  return (
    <div className="space-y-1 text-sm text-muted-foreground">
      <p>
        <span className="font-medium text-foreground">{COMPENSATION_RULE_TYPE_LABELS[rule_type]}</span> —{" "}
        {describeRule(rule_type, rule_config)}.
      </p>
      <p>
        Invoice subtotal {formatCurrency(invoice_subtotal)}, this payment covered {formatCurrency(payment_amount)} of
        it, which computed to{" "}
        <span className="font-medium text-foreground">{formatCurrency(computed_amount)}</span> for this entry.
      </p>
    </div>
  );
}

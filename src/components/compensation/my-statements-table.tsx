"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { MyCompensationEarningsTable } from "@/components/compensation/my-compensation-earnings-table";
import { formatCurrency } from "@/lib/billing/format";
import type { CompensationRule, DoctorEarning, DoctorSettlement, VisitType } from "@/types/domain";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString();
}

export function MyStatementsTable({
  settlements,
  earnings,
  rules,
  visitTypes,
}: {
  settlements: DoctorSettlement[];
  /** Full ledger, already fetched once for the Earnings tab — filtered per settlement here rather than re-querying. */
  earnings: DoctorEarning[];
  rules: CompensationRule[];
  visitTypes: VisitType[];
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (settlements.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
        No settlement statements yet. Your first statement will appear here once your earnings are settled.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {settlements.map((settlement) => {
        const isExpanded = expanded.has(settlement.id);
        const sweptEntries = earnings.filter((entry) => entry.settlement_id === settlement.id);

        return (
          <div key={settlement.id} className="overflow-hidden rounded-xl border border-border">
            <button
              type="button"
              onClick={() => toggle(settlement.id)}
              className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left hover:bg-accent/40"
            >
              <div className="flex items-center gap-2 text-sm font-medium">
                {isExpanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                {formatDate(settlement.period_start)} – {formatDate(settlement.period_end)}
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>Settled {formatDate(settlement.settled_at)}</span>
                <span className="font-medium text-foreground tabular-nums">
                  {formatCurrency(Number(settlement.total_amount))}
                </span>
              </div>
            </button>
            {isExpanded && (
              <div className="border-t border-border p-3">
                <MyCompensationEarningsTable
                  earnings={sweptEntries}
                  rules={rules}
                  visitTypes={visitTypes}
                  emptyMessage="No entries recorded for this statement."
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

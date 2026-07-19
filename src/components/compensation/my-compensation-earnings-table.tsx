"use client";

import { Fragment, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RateSnapshotDisclosure } from "@/components/compensation/rate-snapshot-disclosure";
import { formatCurrency } from "@/lib/billing/format";
import type { CompensationEntryType, CompensationRule, DoctorEarning, VisitType } from "@/types/domain";

const ENTRY_TYPE_LABELS: Record<CompensationEntryType, string> = {
  earning: "Earning",
  reversal: "Reversal",
  correction: "Correction",
  unresolved: "Unresolved",
};

const ENTRY_TYPE_BADGE_VARIANT: Record<CompensationEntryType, "default" | "secondary" | "outline" | "destructive"> = {
  earning: "secondary",
  reversal: "destructive",
  correction: "outline",
  unresolved: "destructive",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString();
}

/** Resolved via the doctor's own rule set, not a new query — a rule row already carries visit_type_id. */
function procedureNameFor(earning: DoctorEarning, rules: CompensationRule[], visitTypes: VisitType[]): string {
  if (!earning.compensation_rule_id) return "—";
  const rule = rules.find((r) => r.id === earning.compensation_rule_id);
  if (!rule) return "—";
  if (!rule.visit_type_id) return "All procedures";
  return visitTypes.find((v) => v.id === rule.visit_type_id)?.name ?? "—";
}

function statusFor(earning: DoctorEarning): { label: string; variant: "default" | "secondary" | "outline" } {
  if (earning.voided_at) return { label: "Voided", variant: "outline" };
  if (earning.settlement_id) return { label: "Settled", variant: "secondary" };
  return { label: "Pending", variant: "default" };
}

export function MyCompensationEarningsTable({
  earnings,
  rules,
  visitTypes,
  emptyMessage,
}: {
  earnings: DoctorEarning[];
  rules: CompensationRule[];
  visitTypes: VisitType[];
  emptyMessage: string;
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

  if (earnings.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <span className="sr-only">Expand</span>
            </TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Procedure</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {earnings.map((earning) => {
            const entryType = earning.entry_type as CompensationEntryType;
            const isExpanded = expanded.has(earning.id);
            const status = statusFor(earning);

            return (
              <Fragment key={earning.id}>
                <TableRow>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => toggle(earning.id)}>
                      {isExpanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                      <span className="sr-only">Why this amount</span>
                    </Button>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(earning.created_at)}</TableCell>
                  <TableCell>{procedureNameFor(earning, rules, visitTypes)}</TableCell>
                  <TableCell>
                    <Badge variant={ENTRY_TYPE_BADGE_VARIANT[entryType]}>{ENTRY_TYPE_LABELS[entryType]}</Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(Number(earning.amount))}</TableCell>
                  <TableCell>
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </TableCell>
                </TableRow>
                {isExpanded && (
                  <TableRow>
                    <TableCell colSpan={6} className="bg-muted/30">
                      <RateSnapshotDisclosure entryType={entryType} rateSnapshot={earning.rate_snapshot} />
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

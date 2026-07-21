"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { resolveUnresolvedEarning } from "@/lib/compensation/actions";
import { formatCurrency } from "@/lib/billing/format";
import type { DoctorEarning, VisitType } from "@/types/domain";
import type { DoctorOption } from "@/lib/patients/queries";
import { EmptyState } from "@/components/ui/empty-state";

/** One unresolved row, enriched server-side with display context the earning row itself can't carry (see queries.ts's getPaymentsByIds and the rule_missing audit-log lookup in the page). */
export interface UnresolvedEntryRow {
  entry: DoctorEarning;
  visitTypeId: string | null;
  paymentAmount: number | null;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString();
}

/** Exported so the page's "Oldest Unresolved" stat card can reuse the exact same wording. */
export function formatAge(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 0) return "Today";
  if (days === 1) return "1 day";
  return `${days} days`;
}

export function UnresolvedCompensationTable({
  rows,
  doctors,
  visitTypes,
  canManage,
  hasFilters,
}: {
  rows: UnresolvedEntryRow[];
  doctors: DoctorOption[];
  visitTypes: VisitType[];
  canManage: boolean;
  hasFilters: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  function handleResolve(earningId: string) {
    setResolvingId(earningId);
    startTransition(async () => {
      const result = await resolveUnresolvedEarning(earningId);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Entry resolved");
        router.refresh();
      }
      setResolvingId(null);
    });
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        title={
          hasFilters
            ? "No unresolved entries match this filter."
            : "No unresolved compensation. Every payment has a matching rule."
        }
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Doctor</TableHead>
            <TableHead>Procedure</TableHead>
            <TableHead>Invoice</TableHead>
            <TableHead className="text-right">Payment Amount</TableHead>
            <TableHead>Age</TableHead>
            {canManage && <TableHead className="text-right">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(({ entry, visitTypeId, paymentAmount }) => {
            const doctorName = doctors.find((d) => d.id === entry.doctor_id)?.full_name ?? "—";
            const procedureName = visitTypeId ? (visitTypes.find((v) => v.id === visitTypeId)?.name ?? "—") : "—";
            const isResolving = pending && resolvingId === entry.id;

            return (
              <TableRow key={entry.id}>
                <TableCell className="text-muted-foreground">{formatDate(entry.created_at)}</TableCell>
                <TableCell>Dr. {doctorName}</TableCell>
                <TableCell>{procedureName}</TableCell>
                <TableCell>
                  <Link href={`/billing/invoices/${entry.invoice_id}`} className="hover:underline">
                    View invoice
                  </Link>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {paymentAmount !== null ? formatCurrency(paymentAmount) : "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">{formatAge(entry.created_at)}</TableCell>
                {canManage && (
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" disabled={pending} onClick={() => handleResolve(entry.id)}>
                      {isResolving && <Loader2 className="size-3.5 animate-spin" />}
                      Resolve
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

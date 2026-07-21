"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Undo2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { voidPayment } from "@/lib/billing/actions";
import { formatCurrency } from "@/lib/billing/format";
import { PAYMENT_METHOD_LABELS, PAYMENT_TYPE_LABELS, type Payment, type PaymentMethod, type PaymentType } from "@/types/domain";
import { EmptyState } from "@/components/ui/empty-state";

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function PaymentsHistory({
  invoiceId,
  payments,
  canEdit,
}: {
  invoiceId: string;
  payments: Payment[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [voidingId, setVoidingId] = useState<string | null>(null);

  function handleVoid(paymentId: string) {
    startTransition(async () => {
      const result = await voidPayment(paymentId, invoiceId);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Payment voided");
        setVoidingId(null);
        router.refresh();
      }
    });
  }

  if (payments.length === 0) {
    return (
      <EmptyState title={"No payments recorded yet."} />
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Date</TableHead>
              {canEdit && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map((payment) => (
              <TableRow key={payment.id}>
                <TableCell>
                  <Badge variant={payment.type === "refund" ? "destructive" : "secondary"}>
                    {PAYMENT_TYPE_LABELS[payment.type as PaymentType]}
                  </Badge>
                </TableCell>
                <TableCell>{PAYMENT_METHOD_LABELS[payment.method as PaymentMethod]}</TableCell>
                <TableCell className="text-muted-foreground">{payment.reference || "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(Number(payment.amount))}</TableCell>
                <TableCell className="text-muted-foreground">{formatTimestamp(payment.paid_at)}</TableCell>
                {canEdit && (
                  <TableCell className="text-right">
                    {payment.type === "payment" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={pending}
                        onClick={() => setVoidingId(payment.id)}
                      >
                        <Undo2 className="size-3.5" />
                        Void
                      </Button>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!voidingId} onOpenChange={(open) => !open && setVoidingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Void this payment?</AlertDialogTitle>
            <AlertDialogDescription>
              This corrects a mistaken entry — the payment is removed from the invoice&apos;s totals
              entirely. If money genuinely needs to go back to the patient, use Refund instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={pending}
              onClick={() => voidingId && handleVoid(voidingId)}
            >
              {pending && <Loader2 className="size-4 animate-spin" />}
              Void payment
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { refundPayment } from "@/lib/billing/actions";
import { formatCurrency } from "@/lib/billing/format";
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from "@/types/domain";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const METHOD_OPTIONS = Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[];

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="text-sm text-destructive" role="alert">
      {message}
    </p>
  );
}

export function RefundPaymentDialog({
  invoiceId,
  paidAmount,
  open,
  onOpenChange,
}: {
  invoiceId: string;
  paidAmount: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [method, setMethod] = useState<PaymentMethod>("cash");

  function handleSubmit(formData: FormData) {
    formData.set("method", method);
    startTransition(async () => {
      const result = await refundPayment(invoiceId, formData);
      if (result.error) {
        toast.error(result.error);
        setFieldErrors(result.fieldErrors ?? {});
      } else {
        toast.success("Refund recorded");
        setFieldErrors({});
        onOpenChange(false);
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Issue Refund</DialogTitle>
          <DialogDescription>
            Up to {formatCurrency(paidAmount)} already paid can be refunded. This is recorded as its own
            transaction, separate from the original payment.
          </DialogDescription>
        </DialogHeader>

        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="refund-amount">Amount *</Label>
            <Input id="refund-amount" name="amount" type="number" min={0.01} max={paidAmount} step={0.01} required />
            <FieldError message={fieldErrors.amount} />
          </div>

          <div className="space-y-2">
            <Label>Method *</Label>
            <Select value={method} onValueChange={(value) => setMethod(value as PaymentMethod)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {METHOD_OPTIONS.map((value) => (
                  <SelectItem key={value} value={value}>
                    {PAYMENT_METHOD_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="refund-reference">Reference</Label>
            <Input id="refund-reference" name="reference" placeholder="Receipt / transaction #" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="refund-notes">Reason *</Label>
            <Textarea id="refund-notes" name="notes" required />
            <FieldError message={fieldErrors.notes} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              Issue refund
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

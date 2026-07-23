"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { recordPayment } from "@/lib/billing/actions";
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

export function RecordPaymentDialog({
  invoiceId,
  open,
  onOpenChange,
}: {
  invoiceId: string;
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
      const result = await recordPayment(invoiceId, formData);
      if (result.error) {
        toast.error(result.error);
        setFieldErrors(result.fieldErrors ?? {});
      } else {
        toast.success("Payment recorded");
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
          <DialogTitle>Record Payment</DialogTitle>
          <DialogDescription>Log a payment collected against this invoice.</DialogDescription>
        </DialogHeader>

        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="payment-amount">Amount *</Label>
            <Input id="payment-amount" name="amount" type="number" min={0.01} step={0.01} required />
            <FieldError message={fieldErrors.amount} />
          </div>

          <div className="space-y-2">
            <Label>Method *</Label>
            <Select
              items={Object.fromEntries(METHOD_OPTIONS.map((v) => [v, PAYMENT_METHOD_LABELS[v]]))}
              value={method}
              onValueChange={(value) => setMethod(value as PaymentMethod)}
            >
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
            <Label htmlFor="payment-reference">Reference</Label>
            <Input id="payment-reference" name="reference" placeholder="Receipt / transaction #" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment-notes">Notes</Label>
            <Textarea id="payment-notes" name="notes" />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              Record payment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

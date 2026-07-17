"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Ban, CreditCard, Loader2, Pencil, ReceiptText, Trash2, Undo2 } from "lucide-react";

import { cancelInvoice, deleteInvoice, issueInvoice } from "@/lib/billing/actions";
import { canCancelInvoice, canRecordPayment, canRefundPayment } from "@/lib/billing/calculations";
import { hasPermission, PERMISSIONS } from "@/lib/authz/permissions";
import type { InvoiceDetail } from "@/lib/billing/queries";

import { Button } from "@/components/ui/button";
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
import { InvoiceFormSheet } from "@/components/billing/invoice-form-sheet";
import { RecordPaymentDialog } from "@/components/billing/record-payment-dialog";
import { RefundPaymentDialog } from "@/components/billing/refund-payment-dialog";

export function InvoiceDetailActions({
  invoice,
  permissions,
}: {
  invoice: InvoiceDetail;
  permissions: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editOpen, setEditOpen] = useState(false);
  const [recordPaymentOpen, setRecordPaymentOpen] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const canEdit = hasPermission(permissions, PERMISSIONS.BILLING_EDIT);
  if (!canEdit) return null;

  const status = invoice.status;
  const paidAmount = Number(invoice.paid_amount);
  const isDraft = status === "draft";
  const canRecord = canRecordPayment(status);
  const canRefund = canRefundPayment(status) && paidAmount > 0;
  const canCancel = canCancelInvoice(status, paidAmount);

  function handleIssue() {
    startTransition(async () => {
      const result = await issueInvoice(invoice.id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Invoice issued");
        router.refresh();
      }
    });
  }

  function handleCancel() {
    startTransition(async () => {
      const result = await cancelInvoice(invoice.id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Invoice cancelled");
        setCancelOpen(false);
        router.refresh();
      }
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteInvoice(invoice.id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Invoice deleted");
        router.push("/billing/invoices");
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {isDraft && (
        <Button variant="outline" disabled={pending} onClick={() => setEditOpen(true)}>
          <Pencil className="size-4" />
          Edit
        </Button>
      )}

      {isDraft && (
        <Button disabled={pending} onClick={handleIssue}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <ReceiptText className="size-4" />}
          Issue
        </Button>
      )}

      {canRecord && (
        <Button onClick={() => setRecordPaymentOpen(true)}>
          <CreditCard className="size-4" />
          Record Payment
        </Button>
      )}

      {canRefund && (
        <Button variant="outline" onClick={() => setRefundOpen(true)}>
          <Undo2 className="size-4" />
          Refund
        </Button>
      )}

      {canCancel && (
        <Button variant="outline" disabled={pending} onClick={() => setCancelOpen(true)}>
          <Ban className="size-4" />
          Cancel
        </Button>
      )}

      <Button variant="destructive" disabled={pending} onClick={() => setDeleteOpen(true)}>
        <Trash2 className="size-4" />
        Delete
      </Button>

      {isDraft && <InvoiceFormSheet invoice={invoice} open={editOpen} onOpenChange={setEditOpen} />}

      {canRecord && (
        <RecordPaymentDialog invoiceId={invoice.id} open={recordPaymentOpen} onOpenChange={setRecordPaymentOpen} />
      )}

      {canRefund && (
        <RefundPaymentDialog
          invoiceId={invoice.id}
          paidAmount={paidAmount}
          open={refundOpen}
          onOpenChange={setRefundOpen}
        />
      )}

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel invoice {invoice.invoice_number}?</AlertDialogTitle>
            <AlertDialogDescription>
              The invoice becomes a cancelled, read-only record. This can&apos;t be undone from here.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Keep it</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={pending} onClick={handleCancel}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              Cancel invoice
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete invoice {invoice.invoice_number}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the invoice from all lists. This can be undone by a database admin, but not
              from this UI.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={pending} onClick={handleDelete}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              Delete invoice
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

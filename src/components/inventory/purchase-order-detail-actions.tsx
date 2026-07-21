"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, XCircle } from "lucide-react";
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
import { cancelPurchaseOrder } from "@/lib/inventory/actions";
import type { PurchaseOrderStatus } from "@/types/domain";

const CANCEL_INELIGIBLE = new Set<PurchaseOrderStatus>(["received", "cancelled"]);

export function PurchaseOrderDetailActions({
  purchaseOrderId,
  status,
}: {
  purchaseOrderId: string;
  status: PurchaseOrderStatus;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (CANCEL_INELIGIBLE.has(status)) return null;

  function handleCancel() {
    startTransition(async () => {
      const result = await cancelPurchaseOrder(purchaseOrderId);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Purchase order cancelled");
        setConfirmOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <>
      <Button variant="outline" onClick={() => setConfirmOpen(true)}>
        <XCircle className="size-4" />
        Cancel Order
      </Button>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this purchase order?</AlertDialogTitle>
            <AlertDialogDescription>
              This marks the order cancelled. Any stock already received stays in inventory — this can&apos;t be
              undone from this UI.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Keep it</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={pending} onClick={handleCancel}>
              {pending && <Loader2 className="size-3.5 animate-spin" />}
              Cancel order
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

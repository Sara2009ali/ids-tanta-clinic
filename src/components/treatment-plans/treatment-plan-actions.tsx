"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Ban, CircleCheck, Loader2, Send, Trash2 } from "lucide-react";
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
import { abandonTreatmentPlan, activateTreatmentPlan, completeTreatmentPlan, deleteTreatmentPlan } from "@/lib/treatment-plans/actions";
import type { TreatmentPlanStatus } from "@/types/domain";

/**
 * Plan-level actions, gated by current status so a completed/abandoned plan
 * never shows a button for a transition it can't take — mirrors
 * InvoiceDetailActions' status-gated button set. Only draft plans offer
 * Delete: once a plan has been shown to the patient (active/completed/
 * abandoned), it's a historical record and dropping it is what the
 * `abandoned` status is for, not deletion.
 */
export function TreatmentPlanActions({
  planId,
  patientId,
  status,
  canEdit,
}: {
  planId: string;
  patientId: string;
  status: TreatmentPlanStatus;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [abandonOpen, setAbandonOpen] = useState(false);

  if (!canEdit) return null;

  function handleActivate() {
    startTransition(async () => {
      const result = await activateTreatmentPlan(planId);
      if (result.error) toast.error(result.error);
      else {
        toast.success("Plan proposed to patient");
        router.refresh();
      }
    });
  }

  function handleComplete() {
    startTransition(async () => {
      const result = await completeTreatmentPlan(planId);
      if (result.error) toast.error(result.error);
      else {
        toast.success("Plan marked complete");
        router.refresh();
      }
    });
  }

  function handleAbandon() {
    startTransition(async () => {
      const result = await abandonTreatmentPlan(planId);
      if (result.error) toast.error(result.error);
      else {
        toast.success("Plan abandoned");
        setAbandonOpen(false);
        router.refresh();
      }
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteTreatmentPlan(planId);
      if (result.error) toast.error(result.error);
      else {
        toast.success("Draft plan deleted");
        router.push(`/patients/${patientId}`);
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === "draft" && (
        <Button disabled={pending} onClick={handleActivate}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          Activate Plan
        </Button>
      )}

      {status === "active" && (
        <Button disabled={pending} onClick={handleComplete}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <CircleCheck className="size-4" />}
          Complete Plan
        </Button>
      )}

      {status === "active" && (
        <Button variant="outline" disabled={pending} onClick={() => setAbandonOpen(true)}>
          <Ban className="size-4" />
          Abandon Plan
        </Button>
      )}

      {status === "draft" && (
        <Button variant="ghost" className="text-destructive hover:text-destructive" disabled={pending} onClick={() => setDeleteOpen(true)}>
          <Trash2 className="size-4" />
          Delete draft
        </Button>
      )}

      <AlertDialog open={abandonOpen} onOpenChange={setAbandonOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Abandon this treatment plan?</AlertDialogTitle>
            <AlertDialogDescription>
              It stays on the patient&apos;s record as an abandoned plan — this doesn&apos;t delete it, and can&apos;t
              be undone from here.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Keep it active</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={pending} onClick={handleAbandon}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              Abandon plan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this draft plan?</AlertDialogTitle>
            <AlertDialogDescription>
              It was never shown to the patient. This removes it and its items from the patient&apos;s record.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={pending} onClick={handleDelete}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              Delete draft
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

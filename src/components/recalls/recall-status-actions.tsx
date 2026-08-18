"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { changeRecallStatus } from "@/lib/recalls/actions";
import { isRecallActionable } from "@/lib/recalls/calculations";
import { RecallStatusBadge } from "@/components/recalls/recall-status-badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
import { RECALL_STATUS_LABELS, type RecallStatus } from "@/types/domain";

/**
 * Explicit staff-driven status transitions only — this is never invoked by
 * anything reacting to an appointment's status changing (see
 * changeRecallStatus()'s doc comment). Mirrors TreatmentPlanItemRow's
 * inline status Select exactly, with one addition: picking `dismissed`
 * routes through a small confirmation dialog (same AlertDialog shape
 * TreatmentPlanActions already uses for Abandon Plan) so staff can
 * optionally record why, without making a reason mandatory.
 */
export function RecallStatusActions({
  recallId,
  status,
  dueDate,
  canEdit,
}: {
  recallId: string;
  status: RecallStatus;
  dueDate: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [dismissOpen, setDismissOpen] = useState(false);
  const [dismissReason, setDismissReason] = useState("");

  const showSelect = canEdit && isRecallActionable(status);

  function applyStatus(nextStatus: string, reason?: string) {
    startTransition(async () => {
      const result = await changeRecallStatus(recallId, nextStatus, reason);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Recall updated");
        setDismissOpen(false);
        setDismissReason("");
        router.refresh();
      }
    });
  }

  function handleStatusChange(next: string | null) {
    if (!next) return;
    if (next === "dismissed") {
      setDismissOpen(true);
      return;
    }
    applyStatus(next);
  }

  if (!showSelect) {
    return <RecallStatusBadge status={status} dueDate={dueDate} />;
  }

  return (
    <>
      <Select items={RECALL_STATUS_LABELS} value={status} onValueChange={handleStatusChange}>
        <SelectTrigger size="sm" disabled={pending} aria-label="Recall status">
          {pending ? <Loader2 className="size-3.5 animate-spin" /> : <SelectValue />}
        </SelectTrigger>
        <SelectContent>
          {(Object.entries(RECALL_STATUS_LABELS) as [RecallStatus, string][]).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <AlertDialog open={dismissOpen} onOpenChange={(open) => !open && setDismissOpen(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Dismiss this recall?</AlertDialogTitle>
            <AlertDialogDescription>
              It stays on the patient&apos;s record as dismissed — this doesn&apos;t delete it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 px-6">
            <Label htmlFor="dismissed_reason" className="font-normal text-muted-foreground">
              Reason (optional)
            </Label>
            <Textarea
              id="dismissed_reason"
              rows={2}
              value={dismissReason}
              onChange={(event) => setDismissReason(event.target.value)}
              placeholder="e.g. patient transferred to another clinic"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Keep it as-is</AlertDialogCancel>
            <AlertDialogAction disabled={pending} onClick={() => applyStatus("dismissed", dismissReason)}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              Dismiss recall
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

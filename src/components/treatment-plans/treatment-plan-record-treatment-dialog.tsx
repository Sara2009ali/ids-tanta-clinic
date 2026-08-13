"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createTreatmentRecord } from "@/lib/treatments/actions";
import { changeTreatmentPlanItemStatus } from "@/lib/treatment-plans/actions";
import { initialRecordTreatmentVisitTypeId } from "@/lib/treatment-plans/calculations";
import type { TreatmentPlanItemWithContext } from "@/lib/treatment-plans/queries";
import type { VisitType } from "@/types/domain";

/**
 * Second UI entry point to the exact same createTreatmentRecord() action
 * TreatmentRecordForm already uses (src/components/treatments/
 * treatment-record-form.tsx, embedded in AppointmentEditSheet) — not a new
 * treatment-record concept. The procedure picker deliberately mirrors that
 * form's plain, unfiltered, non-grouped <Select> rather than the richer
 * category-grouped/custom-item ProcedurePicker used for editing plan items:
 * a treatment_records row can never be "custom" (visit_type_id is a
 * required, on-delete-restrict FK), so there's no custom option to offer
 * here, and TreatmentRecordForm never filters by is_active either.
 */
export function TreatmentPlanRecordTreatmentDialog({
  item,
  visitTypes,
  open,
  onOpenChange,
}: {
  item: TreatmentPlanItemWithContext;
  visitTypes: VisitType[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [visitTypeId, setVisitTypeId] = useState(initialRecordTreatmentVisitTypeId(item));
  const [notes, setNotes] = useState("");
  const [markCompleted, setMarkCompleted] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const appointmentId = item.appointment_id;
  if (!appointmentId) return null;

  function handleSubmit() {
    // Re-bound to a fresh const so its narrowed `string` type is fixed at
    // declaration time — TypeScript doesn't carry the outer narrowing
    // through into the async startTransition closure below otherwise.
    if (!appointmentId) return;
    const eligibleAppointmentId = appointmentId;

    const formData = new FormData();
    formData.set("visit_type_id", visitTypeId);
    formData.set("notes", notes);
    formData.set("treatment_plan_item_id", item.id);

    startTransition(async () => {
      const result = await createTreatmentRecord(eligibleAppointmentId, formData);
      if (result.error) {
        setError(result.fieldErrors?.visit_type_id ?? result.error);
        toast.error(result.error);
        return;
      }

      // Explicit, dentist-requested second write — never automatic. The
      // treatment record's existence and the item's status remain
      // independent facts either way (approved Treatment Plan design).
      if (markCompleted) {
        const statusResult = await changeTreatmentPlanItemStatus(item.id, "completed");
        if (statusResult.error) {
          toast.error(`Treatment recorded, but the item status wasn't updated: ${statusResult.error}`);
          onOpenChange(false);
          router.refresh();
          return;
        }
      }

      toast.success("Treatment recorded");
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record treatment</DialogTitle>
          <DialogDescription>Log what was actually performed for {item.procedure_name}.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="record_treatment_visit_type_id">Procedure performed *</Label>
            <Select
              items={Object.fromEntries(visitTypes.map((vt) => [vt.id, vt.name]))}
              value={visitTypeId}
              onValueChange={(v) => v && setVisitTypeId(v)}
            >
              <SelectTrigger id="record_treatment_visit_type_id" className="w-full" aria-invalid={!!error}>
                <SelectValue placeholder="Select a procedure" />
              </SelectTrigger>
              <SelectContent>
                {visitTypes.map((visitType) => (
                  <SelectItem key={visitType.id} value={visitType.id}>
                    {visitType.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="record_treatment_notes">Notes</Label>
            <Textarea
              id="record_treatment_notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="What was done, materials used, follow-up needed..."
              rows={3}
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="record_treatment_mark_completed"
              checked={markCompleted}
              onCheckedChange={(checked) => setMarkCompleted(checked === true)}
            />
            <Label htmlFor="record_treatment_mark_completed" className="font-normal">
              Also mark this procedure as completed
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={pending || !visitTypeId} onClick={handleSubmit}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            Record treatment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

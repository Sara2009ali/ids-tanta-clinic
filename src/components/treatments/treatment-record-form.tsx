"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createTreatmentRecord } from "@/lib/treatments/actions";
import type { VisitType } from "@/types/domain";

/** Record-treatment entry point — embedded directly in AppointmentEditSheet's Treatment tab, not a separate Sheet, so there's exactly one place to edit an appointment and one place to record what happened during it. */
export function TreatmentRecordForm({ appointmentId, visitTypes }: { appointmentId: string; visitTypes: VisitType[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [visitTypeId, setVisitTypeId] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | undefined>();

  function handleSubmit(formData: FormData) {
    formData.set("visit_type_id", visitTypeId);
    formData.set("notes", notes);

    startTransition(async () => {
      const result = await createTreatmentRecord(appointmentId, formData);
      if (result.error) {
        setError(result.fieldErrors?.visit_type_id ?? result.error);
        toast.error(result.error);
      } else {
        setVisitTypeId("");
        setNotes("");
        setError(undefined);
        toast.success("Treatment recorded");
        router.refresh();
      }
    });
  }

  return (
    <form action={handleSubmit} className="space-y-3 rounded-xl border border-border p-3">
      <div className="space-y-1.5">
        <Label htmlFor="treatment_visit_type_id">Procedure performed *</Label>
        <Select value={visitTypeId} onValueChange={(v) => v && setVisitTypeId(v)}>
          <SelectTrigger id="treatment_visit_type_id" className="w-full" aria-invalid={!!error}>
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
        <Label htmlFor="treatment_notes">Notes</Label>
        <Textarea
          id="treatment_notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="What was done, materials used, follow-up needed..."
          rows={3}
        />
      </div>

      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={pending || !visitTypeId}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          Record treatment
        </Button>
      </div>
    </form>
  );
}

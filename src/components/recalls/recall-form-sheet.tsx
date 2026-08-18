"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, RotateCcw } from "lucide-react";

import { createRecall, updateRecall } from "@/lib/recalls/actions";
import { PatientPicker, type SelectedPatient } from "@/components/appointments/patient-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/form-field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { DoctorOption } from "@/lib/patients/queries";
import type { RecallListRow } from "@/lib/recalls/queries";
import type { VisitType } from "@/types/domain";

const NO_DOCTOR = "__none__";
const NO_PROCEDURE = "__none__";

/** Pure client-side date math — only the resulting YYYY-MM-DD is ever persisted, no interval is stored (see 0030_recalls.sql's header comment). */
function addToToday(months: number): string {
  const date = new Date();
  date.setMonth(date.getMonth() + months);
  return date.toISOString().slice(0, 10);
}

const QUICK_FILL_OPTIONS: { label: string; months: number }[] = [
  { label: "+3 months", months: 3 },
  { label: "+6 months", months: 6 },
  { label: "+1 year", months: 12 },
];

export interface RecallFormSheetProps {
  /** Editing an existing recall. Omit for create mode. */
  recall?: RecallListRow;
  /** Pre-fills + locks the patient, for "new recall from this patient's profile". Ignored in edit mode. */
  initialPatient?: SelectedPatient;
  doctors: DoctorOption[];
  visitTypes: VisitType[];
  className?: string;
  /** Uncontrolled by default (renders its own trigger button — the /recalls worklist's "New Recall" use case). Pass open/onOpenChange to control it externally instead, same pattern InvoiceFormSheet already uses. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function RecallFormSheet({
  recall,
  initialPatient,
  doctors,
  visitTypes,
  className,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: RecallFormSheetProps) {
  const router = useRouter();
  const isEdit = !!recall;
  const isControlled = controlledOpen !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? (controlledOnOpenChange ?? (() => {})) : setInternalOpen;

  const [pending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [patient, setPatient] = useState<SelectedPatient | null>(
    recall ? { id: recall.patient_id, full_name: recall.patient_name } : (initialPatient ?? null),
  );
  const [doctorId, setDoctorId] = useState<string | null>(recall?.doctor_id ?? null);
  const [visitTypeId, setVisitTypeId] = useState<string | null>(recall?.visit_type_id ?? null);
  const [dueDate, setDueDate] = useState(recall?.due_date ?? "");
  const lockPatient = isEdit || !!initialPatient;

  function resetForm() {
    setFieldErrors({});
    if (!isEdit) {
      setPatient(initialPatient ?? null);
      setDoctorId(null);
      setVisitTypeId(null);
      setDueDate("");
    }
  }

  function handleSubmit(formData: FormData) {
    formData.set("patient_id", patient?.id ?? "");
    formData.set("doctor_id", doctorId ?? "");
    formData.set("visit_type_id", visitTypeId ?? "");
    formData.set("due_date", dueDate);

    startTransition(async () => {
      const result = isEdit ? await updateRecall(recall.id, formData) : await createRecall(formData);

      if (result.error) {
        toast.error(result.error);
        setFieldErrors(result.fieldErrors ?? {});
      } else {
        toast.success(isEdit ? "Recall updated" : "Recall created");
        setOpen(false);
        resetForm();
        router.refresh();
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) resetForm();
      }}
    >
      {!isControlled && (
        <DialogTrigger render={<Button className={className} />}>
          <RotateCcw className="size-4" />
          New Recall
        </DialogTrigger>
      )}
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit recall" : "New recall"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Update this follow-up." : "Flag a patient for a clinical follow-up."}
          </DialogDescription>
        </DialogHeader>

        <form action={handleSubmit} className="space-y-3">
          <div className="space-y-2">
            <Label>
              Patient
              <span aria-hidden="true" className="text-destructive">
                *
              </span>
            </Label>
            {lockPatient ? (
              <div className="rounded-lg border border-input bg-muted/50 px-2.5 py-1.5 text-sm">
                {patient?.full_name}
              </div>
            ) : (
              <PatientPicker value={patient} onChange={setPatient} error={fieldErrors.patient_id} />
            )}
          </div>

          <FormField label="Reason" htmlFor="reason" required error={fieldErrors.reason}>
            <Input
              id="reason"
              name="reason"
              defaultValue={recall?.reason ?? ""}
              placeholder="e.g. 6-month hygiene recall"
              aria-invalid={!!fieldErrors.reason}
            />
          </FormField>

          <FormField label="Due date" htmlFor="due_date" required error={fieldErrors.due_date}>
            <div className="space-y-2">
              <Input
                id="due_date"
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
                aria-invalid={!!fieldErrors.due_date}
              />
              <div className="flex flex-wrap gap-1.5">
                {QUICK_FILL_OPTIONS.map((option) => (
                  <button
                    key={option.label}
                    type="button"
                    onClick={() => setDueDate(addToToday(option.months))}
                    className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </FormField>

          <FormField label="Assigned doctor" htmlFor="doctor_id" description="Optional">
            <Select
              items={{ [NO_DOCTOR]: "No doctor assigned", ...Object.fromEntries(doctors.map((d) => [d.id, `Dr. ${d.full_name}`])) }}
              value={doctorId ?? NO_DOCTOR}
              onValueChange={(value) => setDoctorId(!value || value === NO_DOCTOR ? null : value)}
            >
              <SelectTrigger id="doctor_id" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_DOCTOR}>No doctor assigned</SelectItem>
                {doctors.map((doctor) => (
                  <SelectItem key={doctor.id} value={doctor.id}>
                    Dr. {doctor.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <FormField label="Procedure" htmlFor="visit_type_id" description="Optional — tags this recall to a catalog procedure">
            <Select
              items={{ [NO_PROCEDURE]: "No procedure", ...Object.fromEntries(visitTypes.map((v) => [v.id, v.name])) }}
              value={visitTypeId ?? NO_PROCEDURE}
              onValueChange={(value) => setVisitTypeId(!value || value === NO_PROCEDURE ? null : value)}
            >
              <SelectTrigger id="visit_type_id" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_PROCEDURE}>No procedure</SelectItem>
                {visitTypes.map((visitType) => (
                  <SelectItem key={visitType.id} value={visitType.id}>
                    {visitType.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <FormField label="Notes" htmlFor="notes" description="Optional">
            <Textarea id="notes" name="notes" rows={2} defaultValue={recall?.notes ?? ""} />
          </FormField>

          <DialogFooter className="pt-2">
            <DialogClose render={<Button type="button" variant="outline" disabled={pending} />}>Cancel</DialogClose>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              {isEdit ? "Save changes" : "Create recall"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

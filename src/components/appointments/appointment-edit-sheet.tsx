"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { updateAppointment } from "@/lib/appointments/actions";
import { hasPermission, PERMISSIONS } from "@/lib/authz/permissions";
import type { Chair, TreatmentRecord, VisitType } from "@/types/domain";
import type { DoctorOption } from "@/lib/patients/queries";
import type { ScheduleRow } from "@/lib/appointments/queries";

import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppointmentFormFields } from "@/components/appointments/appointment-form-fields";
import { UNASSIGNED_CHAIR_VALUE } from "@/components/appointments/chair-select";
import { TreatmentRecordForm } from "@/components/treatments/treatment-record-form";
import { TreatmentRecordsList } from "@/components/treatments/treatment-records-list";

// Recording treatment only makes sense once the patient has actually been
// seen — matches AppointmentRowActions' own COMPLETE_ELIGIBLE set, plus
// 'completed' itself (treatment can still be logged/amended after the
// visit closes out).
const TREATMENT_ELIGIBLE = new Set(["checked_in", "waiting", "in_treatment", "completed"]);

/**
 * Controlled — no built-in trigger, unlike AppointmentFormSheet. Callers
 * (AppointmentRowActions) own `open`/`onOpenChange`, since it's opened from
 * a dropdown menu item rather than its own button, matching how
 * PatientRowActions controls its delete AlertDialog externally.
 *
 * The Treatment tab is the appointment-workflow integration point for
 * Treatments/Procedures Management: one Sheet, one edit entry point, no
 * parallel "record treatment" flow — clinical.view/clinical.edit gate its
 * visibility and its create form respectively, same permission split
 * granted since 0007_reapply_rbac.sql (dentist: both, dental_assistant:
 * view only, front-desk/finance roles: neither, so they see only Details).
 */
export function AppointmentEditSheet({
  appointment,
  doctors,
  chairs,
  visitTypes,
  treatmentRecords,
  permissions,
  open,
  onOpenChange,
}: {
  appointment: ScheduleRow;
  doctors: DoctorOption[];
  chairs: Chair[];
  visitTypes: VisitType[];
  treatmentRecords: TreatmentRecord[];
  permissions: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const canViewClinical = hasPermission(permissions, PERMISSIONS.CLINICAL_VIEW);
  const canEditClinical = hasPermission(permissions, PERMISSIONS.CLINICAL_EDIT);
  const treatmentEligible = TREATMENT_ELIGIBLE.has(appointment.status);

  function handleSubmit(formData: FormData) {
    if (formData.get("chair_id") === UNASSIGNED_CHAIR_VALUE) {
      formData.delete("chair_id");
    }

    startTransition(async () => {
      const result = await updateAppointment(appointment.id, formData);
      if (result.error) {
        toast.error(result.error);
        setFieldErrors(result.fieldErrors ?? {});
      } else {
        toast.success("Appointment updated");
        setFieldErrors({});
        onOpenChange(false);
        router.refresh();
      }
    });
  }

  const start = new Date(appointment.scheduled_start);
  const durationMinutes = Math.round(
    (new Date(appointment.scheduled_end).getTime() - start.getTime()) / 60_000,
  );

  return (
    <Sheet
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) setFieldErrors({});
      }}
    >
      <SheetContent className="sm:max-w-lg" side="right">
        <SheetHeader>
          <SheetTitle>Edit Appointment</SheetTitle>
          <SheetDescription>Update {appointment.patient_name}&apos;s appointment.</SheetDescription>
        </SheetHeader>

        <Tabs defaultValue="details" className="flex flex-1 flex-col overflow-y-auto px-4">
          {canViewClinical && (
            <TabsList className="mb-2 self-start">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="treatment">Treatment</TabsTrigger>
            </TabsList>
          )}

          <TabsContent value="details" className="flex flex-1 flex-col">
            <form action={handleSubmit} className="flex flex-1 flex-col gap-4">
              <AppointmentFormFields
                key={open ? "open" : "closed"}
                doctors={doctors}
                chairs={chairs}
                visitTypes={visitTypes}
                fieldErrors={fieldErrors}
                defaultPatient={{ id: appointment.patient_id, full_name: appointment.patient_name }}
                defaultDoctorId={appointment.doctor_id}
                defaultChairId={appointment.chair_id}
                defaultVisitTypeId={appointment.visit_type_id}
                defaultScheduledDate={start.toISOString().slice(0, 10)}
                defaultScheduledTime={start.toTimeString().slice(0, 5)}
                defaultDurationMinutes={durationMinutes}
                defaultPriority={appointment.priority}
                defaultIsEmergency={appointment.is_emergency}
                defaultChiefComplaint={appointment.chief_complaint ?? ""}
                defaultNotes={appointment.notes ?? ""}
              />

              <div className="mt-auto flex justify-end gap-2 pt-2 pb-4">
                <SheetClose render={<Button type="button" variant="outline" disabled={pending} />}>
                  Cancel
                </SheetClose>
                <Button type="submit" disabled={pending}>
                  {pending && <Loader2 className="size-4 animate-spin" />}
                  Save changes
                </Button>
              </div>
            </form>
          </TabsContent>

          {canViewClinical && (
            <TabsContent value="treatment" className="flex flex-1 flex-col gap-4 pb-4">
              {canEditClinical &&
                (treatmentEligible ? (
                  <TreatmentRecordForm appointmentId={appointment.id} visitTypes={visitTypes} />
                ) : (
                  <p className="rounded-xl border border-dashed border-border p-3 text-sm text-muted-foreground">
                    Check the patient in to begin recording treatment.
                  </p>
                ))}
              <TreatmentRecordsList
                records={treatmentRecords}
                visitTypes={visitTypes}
                doctors={doctors}
                canEdit={canEditClinical}
                emptyMessage="No treatment recorded for this visit yet."
              />
            </TabsContent>
          )}
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { updateAppointment } from "@/lib/appointments/actions";
import type { Chair, VisitType } from "@/types/domain";
import type { DoctorOption } from "@/lib/patients/queries";
import type { ScheduleRow } from "@/lib/appointments/queries";

import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { AppointmentFormFields } from "@/components/appointments/appointment-form-fields";
import { UNASSIGNED_CHAIR_VALUE } from "@/components/appointments/chair-select";

/**
 * Controlled — no built-in trigger, unlike AppointmentFormSheet. Callers
 * (AppointmentRowActions) own `open`/`onOpenChange`, since it's opened from
 * a dropdown menu item rather than its own button, matching how
 * PatientRowActions controls its delete AlertDialog externally.
 */
export function AppointmentEditSheet({
  appointment,
  doctors,
  chairs,
  visitTypes,
  open,
  onOpenChange,
}: {
  appointment: ScheduleRow;
  doctors: DoctorOption[];
  chairs: Chair[];
  visitTypes: VisitType[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

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

        <form action={handleSubmit} className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
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
      </SheetContent>
    </Sheet>
  );
}

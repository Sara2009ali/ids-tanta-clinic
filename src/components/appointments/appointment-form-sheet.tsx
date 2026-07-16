"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarPlus, Loader2 } from "lucide-react";

import { createAppointment } from "@/lib/appointments/actions";
import { calculateEndTime } from "@/lib/appointments/validation";
import type { Chair, VisitType } from "@/types/domain";
import type { DoctorOption } from "@/lib/patients/queries";

import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DoctorSelect } from "@/components/patients/doctor-select";
import { ChairSelect, UNASSIGNED_CHAIR_VALUE } from "@/components/appointments/chair-select";
import { VisitTypeSelect } from "@/components/appointments/visit-type-select";
import { PatientPicker, type SelectedPatient } from "@/components/appointments/patient-picker";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="text-sm text-destructive" role="alert">
      {message}
    </p>
  );
}

/** Rounds "now" up to the next 30-minute mark, for a sensible default slot. */
function defaultTimeSlot() {
  const now = new Date();
  const remainder = now.getMinutes() % 30;
  now.setMinutes(now.getMinutes() + (remainder === 0 ? 0 : 30 - remainder), 0, 0);
  return { date: now.toISOString().slice(0, 10), time: now.toTimeString().slice(0, 5) };
}

export function AppointmentFormSheet({
  doctors,
  chairs,
  visitTypes,
  className,
}: {
  doctors: DoctorOption[];
  chairs: Chair[];
  visitTypes: VisitType[];
  className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [patient, setPatient] = useState<SelectedPatient | null>(null);

  const initialSlot = useMemo(() => defaultTimeSlot(), []);
  const [scheduledDate, setScheduledDate] = useState(initialSlot.date);
  const [scheduledTime, setScheduledTime] = useState(initialSlot.time);
  const [durationMinutes, setDurationMinutes] = useState(30);

  const endsAtLabel = useMemo(() => {
    if (!scheduledDate || !scheduledTime || !durationMinutes) return null;
    const startDate = new Date(`${scheduledDate}T${scheduledTime}`);
    if (Number.isNaN(startDate.getTime())) return null;
    const endIso = calculateEndTime(startDate.toISOString(), durationMinutes);
    return new Date(endIso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }, [scheduledDate, scheduledTime, durationMinutes]);

  function resetForm() {
    setFieldErrors({});
    setPatient(null);
    const slot = defaultTimeSlot();
    setScheduledDate(slot.date);
    setScheduledTime(slot.time);
    setDurationMinutes(30);
  }

  function handleVisitTypeChange(visitTypeId: string) {
    const visitType = visitTypes.find((item) => item.id === visitTypeId);
    if (visitType) {
      setDurationMinutes(visitType.default_duration_minutes);
    }
  }

  function handleSubmit(formData: FormData) {
    if (formData.get("chair_id") === UNASSIGNED_CHAIR_VALUE) {
      formData.delete("chair_id");
    }

    startTransition(async () => {
      const result = await createAppointment(formData);
      if (result.error) {
        toast.error(result.error);
        setFieldErrors(result.fieldErrors ?? {});
      } else {
        toast.success("Appointment created");
        setOpen(false);
        resetForm();
        router.refresh();
      }
    });
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) resetForm();
      }}
    >
      <SheetTrigger render={<Button className={className} />}>
        <CalendarPlus className="size-4" />
        New Appointment
      </SheetTrigger>
      <SheetContent className="sm:max-w-lg" side="right">
        <SheetHeader>
          <SheetTitle>New Appointment</SheetTitle>
          <SheetDescription>Book a patient into the schedule.</SheetDescription>
        </SheetHeader>

        <form action={handleSubmit} className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
          <div className="space-y-2">
            <Label>Patient *</Label>
            <PatientPicker value={patient} onChange={setPatient} error={fieldErrors.patient_id} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="doctor_id">Doctor *</Label>
            <DoctorSelect doctors={doctors} id="doctor_id" name="doctor_id" />
            <FieldError message={fieldErrors.doctor_id} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="chair_id">Chair</Label>
            <ChairSelect chairs={chairs} id="chair_id" name="chair_id" />
            <FieldError message={fieldErrors.chair_id} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="visit_type_id">Visit type *</Label>
            <VisitTypeSelect
              visitTypes={visitTypes}
              id="visit_type_id"
              name="visit_type_id"
              onValueChange={handleVisitTypeChange}
            />
            <FieldError message={fieldErrors.visit_type_id} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="scheduled_date">Date *</Label>
              <Input
                id="scheduled_date"
                name="scheduled_date"
                type="date"
                value={scheduledDate}
                onChange={(event) => setScheduledDate(event.target.value)}
                aria-invalid={!!fieldErrors.scheduled_date}
              />
              <FieldError message={fieldErrors.scheduled_date} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="scheduled_time">Time *</Label>
              <Input
                id="scheduled_time"
                name="scheduled_time"
                type="time"
                value={scheduledTime}
                onChange={(event) => setScheduledTime(event.target.value)}
                aria-invalid={!!fieldErrors.scheduled_time}
              />
              <FieldError message={fieldErrors.scheduled_time} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="duration_minutes">Duration (minutes) *</Label>
            <Input
              id="duration_minutes"
              name="duration_minutes"
              type="number"
              min={5}
              max={480}
              step={5}
              value={durationMinutes}
              onChange={(event) => setDurationMinutes(Number(event.target.value))}
              aria-invalid={!!fieldErrors.duration_minutes}
            />
            {endsAtLabel && <p className="text-xs text-muted-foreground">Ends at {endsAtLabel}</p>}
            <FieldError message={fieldErrors.duration_minutes} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="priority">Priority</Label>
            <Select name="priority" defaultValue="normal">
              <SelectTrigger id="priority" className="w-full">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
            <FieldError message={fieldErrors.priority} />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox id="is_emergency" name="is_emergency" />
            <Label htmlFor="is_emergency" className="font-normal">
              Mark as emergency
            </Label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="chief_complaint">Chief complaint</Label>
            <Textarea id="chief_complaint" name="chief_complaint" />
            <FieldError message={fieldErrors.chief_complaint} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" />
            <FieldError message={fieldErrors.notes} />
          </div>

          <div className="mt-auto flex justify-end gap-2 pt-2 pb-4">
            <SheetClose render={<Button type="button" variant="outline" disabled={pending} />}>
              Cancel
            </SheetClose>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              Create appointment
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

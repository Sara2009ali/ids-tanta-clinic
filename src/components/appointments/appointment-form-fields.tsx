"use client";

import { useMemo, useState } from "react";

import { calculateEndTime } from "@/lib/appointments/validation";
import type { Chair, VisitType } from "@/types/domain";
import type { DoctorOption } from "@/lib/patients/queries";

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
import { ChairSelect } from "@/components/appointments/chair-select";
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

/** Rounds "now" up to the next 30-minute mark, for a sensible default slot when creating. */
function defaultTimeSlot() {
  const now = new Date();
  const remainder = now.getMinutes() % 30;
  now.setMinutes(now.getMinutes() + (remainder === 0 ? 0 : 30 - remainder), 0, 0);
  return { date: now.toISOString().slice(0, 10), time: now.toTimeString().slice(0, 5) };
}

export interface AppointmentFormFieldsProps {
  doctors: DoctorOption[];
  chairs: Chair[];
  visitTypes: VisitType[];
  fieldErrors: Record<string, string>;
  defaultPatient?: SelectedPatient | null;
  defaultDoctorId?: string;
  defaultChairId?: string | null;
  defaultVisitTypeId?: string;
  /** YYYY-MM-DD. Omit for create mode's "next 30-minute mark" default. */
  defaultScheduledDate?: string;
  /** HH:MM. Omit for create mode's "next 30-minute mark" default. */
  defaultScheduledTime?: string;
  defaultDurationMinutes?: number;
  defaultPriority?: string;
  defaultIsEmergency?: boolean;
  defaultChiefComplaint?: string;
  defaultNotes?: string;
}

/**
 * Every field row shared by the "New Appointment" and "Edit Appointment"
 * sheets — extracted from what used to be AppointmentFormSheet's inline JSX
 * so both sheets stay in sync without duplicating ~150 lines of markup.
 * Renders only the fields, not the enclosing <form>, Sheet chrome, or
 * submit/cancel buttons — those differ per caller and stay there.
 */
export function AppointmentFormFields({
  doctors,
  chairs,
  visitTypes,
  fieldErrors,
  defaultPatient = null,
  defaultDoctorId,
  defaultChairId,
  defaultVisitTypeId,
  defaultScheduledDate,
  defaultScheduledTime,
  defaultDurationMinutes = 30,
  defaultPriority = "normal",
  defaultIsEmergency = false,
  defaultChiefComplaint = "",
  defaultNotes = "",
}: AppointmentFormFieldsProps) {
  const [patient, setPatient] = useState<SelectedPatient | null>(defaultPatient);

  const initialSlot = useMemo(
    () =>
      defaultScheduledDate && defaultScheduledTime
        ? { date: defaultScheduledDate, time: defaultScheduledTime }
        : defaultTimeSlot(),
    [defaultScheduledDate, defaultScheduledTime],
  );
  const [scheduledDate, setScheduledDate] = useState(initialSlot.date);
  const [scheduledTime, setScheduledTime] = useState(initialSlot.time);
  const [durationMinutes, setDurationMinutes] = useState(defaultDurationMinutes);

  const endsAtLabel = useMemo(() => {
    if (!scheduledDate || !scheduledTime || !durationMinutes) return null;
    const startDate = new Date(`${scheduledDate}T${scheduledTime}`);
    if (Number.isNaN(startDate.getTime())) return null;
    const endIso = calculateEndTime(startDate.toISOString(), durationMinutes);
    return new Date(endIso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }, [scheduledDate, scheduledTime, durationMinutes]);

  function handleVisitTypeChange(visitTypeId: string) {
    const visitType = visitTypes.find((item) => item.id === visitTypeId);
    if (visitType) {
      setDurationMinutes(visitType.default_duration_minutes);
    }
  }

  return (
    <>
      <div className="space-y-2">
        <Label>Patient *</Label>
        <PatientPicker value={patient} onChange={setPatient} error={fieldErrors.patient_id} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="doctor_id">Doctor *</Label>
        <DoctorSelect doctors={doctors} defaultValue={defaultDoctorId} id="doctor_id" name="doctor_id" />
        <FieldError message={fieldErrors.doctor_id} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="chair_id">Chair</Label>
        <ChairSelect chairs={chairs} defaultValue={defaultChairId} id="chair_id" name="chair_id" />
        <FieldError message={fieldErrors.chair_id} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="visit_type_id">Visit type *</Label>
        <VisitTypeSelect
          visitTypes={visitTypes}
          defaultValue={defaultVisitTypeId}
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
        <Select name="priority" defaultValue={defaultPriority}>
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
        <Checkbox id="is_emergency" name="is_emergency" defaultChecked={defaultIsEmergency} />
        <Label htmlFor="is_emergency" className="font-normal">
          Mark as emergency
        </Label>
      </div>

      <div className="space-y-2">
        <Label htmlFor="chief_complaint">Chief complaint</Label>
        <Textarea id="chief_complaint" name="chief_complaint" defaultValue={defaultChiefComplaint} />
        <FieldError message={fieldErrors.chief_complaint} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" name="notes" defaultValue={defaultNotes} />
        <FieldError message={fieldErrors.notes} />
      </div>
    </>
  );
}

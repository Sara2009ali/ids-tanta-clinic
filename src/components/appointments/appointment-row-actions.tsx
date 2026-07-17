"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, LogIn, MoreHorizontal, Pencil, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { AppointmentEditSheet } from "@/components/appointments/appointment-edit-sheet";
import { cancelAppointmentStatus, checkInAppointment, completeAppointment } from "@/lib/appointments/actions";
import { hasPermission, PERMISSIONS } from "@/lib/authz/permissions";
import type { ScheduleRow } from "@/lib/appointments/queries";
import type { Chair, VisitType } from "@/types/domain";
import type { DoctorOption } from "@/lib/patients/queries";

// scheduled/confirmed -> checked_in -> (waiting) -> in_treatment -> completed
// is the expected happy path; these sets just gate which one-click button
// makes sense to show given the appointment's current status, not a formal
// state machine (nothing stops an edit from setting the status directly).
const CHECK_IN_ELIGIBLE = new Set(["scheduled", "confirmed"]);
const COMPLETE_ELIGIBLE = new Set(["checked_in", "waiting", "in_treatment"]);
const CANCEL_INELIGIBLE = new Set(["completed", "cancelled", "no_show"]);

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function AppointmentRowActions({
  appointment,
  doctors,
  chairs,
  visitTypes,
  permissions,
}: {
  appointment: ScheduleRow;
  doctors: DoctorOption[];
  chairs: Chair[];
  visitTypes: VisitType[];
  permissions: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editOpen, setEditOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  const canEdit = hasPermission(permissions, PERMISSIONS.APPOINTMENTS_EDIT);
  const canCancel = hasPermission(permissions, PERMISSIONS.APPOINTMENTS_CANCEL);
  const canCheckIn = canEdit && CHECK_IN_ELIGIBLE.has(appointment.status);
  const canComplete = canEdit && COMPLETE_ELIGIBLE.has(appointment.status);
  const canCancelNow = canCancel && !CANCEL_INELIGIBLE.has(appointment.status);

  if (!canEdit && !canCancel) {
    return null;
  }

  function handleCheckIn() {
    startTransition(async () => {
      const result = await checkInAppointment(appointment.id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`${appointment.patient_name} checked in`);
        router.refresh();
      }
    });
  }

  function handleComplete() {
    startTransition(async () => {
      const result = await completeAppointment(appointment.id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Visit completed");
        router.refresh();
      }
    });
  }

  function handleCancel() {
    startTransition(async () => {
      const result = await cancelAppointmentStatus(appointment.id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Appointment cancelled");
        setCancelOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />}>
          <MoreHorizontal className="size-4" />
          <span className="sr-only">Actions for {appointment.patient_name}</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {canCheckIn && (
            <DropdownMenuItem disabled={pending} onClick={handleCheckIn}>
              <LogIn /> Check in
            </DropdownMenuItem>
          )}
          {canComplete && (
            <DropdownMenuItem disabled={pending} onClick={handleComplete}>
              <CheckCircle2 /> Complete visit
            </DropdownMenuItem>
          )}
          {canEdit && (
            <DropdownMenuItem disabled={pending} onClick={() => setEditOpen(true)}>
              <Pencil /> Edit
            </DropdownMenuItem>
          )}
          {canCancelNow && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" disabled={pending} onClick={() => setCancelOpen(true)}>
                <XCircle /> Cancel
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {canEdit && (
        <AppointmentEditSheet
          appointment={appointment}
          doctors={doctors}
          chairs={chairs}
          visitTypes={visitTypes}
          open={editOpen}
          onOpenChange={setEditOpen}
        />
      )}

      {canCancelNow && (
        <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancel this appointment?</AlertDialogTitle>
              <AlertDialogDescription>
                {appointment.patient_name}&apos;s {formatTime(appointment.scheduled_start)} appointment will be
                marked cancelled. You can reverse this by editing the appointment again.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={pending}>Keep it</AlertDialogCancel>
              <AlertDialogAction variant="destructive" disabled={pending} onClick={handleCancel}>
                Cancel appointment
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}

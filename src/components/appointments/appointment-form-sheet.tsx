"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarPlus, Loader2 } from "lucide-react";

import { createAppointment } from "@/lib/appointments/actions";
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
import { AppointmentFormFields } from "@/components/appointments/appointment-form-fields";
import { UNASSIGNED_CHAIR_VALUE } from "@/components/appointments/chair-select";

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
        setFieldErrors({});
        router.refresh();
      }
    });
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) setFieldErrors({});
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

        <form action={handleSubmit} className="flex flex-1 flex-col gap-4 overflow-y-auto px-5">
          <AppointmentFormFields
            key={open ? "open" : "closed"}
            doctors={doctors}
            chairs={chairs}
            visitTypes={visitTypes}
            fieldErrors={fieldErrors}
          />

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

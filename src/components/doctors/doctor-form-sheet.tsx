"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Pencil, UserPlus } from "lucide-react";

import { createDoctor, updateDoctor } from "@/lib/doctors/actions";
import type { DoctorDetail } from "@/lib/doctors/queries";

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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { FormField } from "@/components/ui/form-field";

const DEFAULT_COLOR = "#6366f1";

export interface DoctorFormSheetProps {
  /** Editing an existing doctor's profile. Omit for create mode. */
  doctor?: DoctorDetail;
  className?: string;
  /** Uncontrolled by default (renders its own trigger button). Pass open/onOpenChange to drive it from elsewhere, matching InvoiceFormSheet. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/**
 * Two field sets behind one component, exactly like InvoiceFormSheet's
 * create/edit split: the create form only asks for what's needed to start
 * a doctor's clinic record (name, phone, login email, specialty, license)
 * — bio, calendar color, and everything else are edit-only, reached from
 * the doctor's own profile page once it exists. Progressive disclosure
 * over one long form.
 */
export function DoctorFormSheet({ doctor, className, open: controlledOpen, onOpenChange: controlledOnOpenChange }: DoctorFormSheetProps) {
  const router = useRouter();
  const isEdit = !!doctor;
  const isControlled = controlledOpen !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? (controlledOnOpenChange ?? (() => {})) : setInternalOpen;

  const [pending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [color, setColor] = useState(doctor?.color ?? DEFAULT_COLOR);

  function resetForm() {
    setFieldErrors({});
    setColor(doctor?.color ?? DEFAULT_COLOR);
  }

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = isEdit ? await updateDoctor(doctor.id, formData) : await createDoctor(formData);

      if (result.error) {
        toast.error(result.error);
        setFieldErrors(result.fieldErrors ?? {});
      } else {
        toast.success(isEdit ? "Doctor updated" : "Doctor added");
        setOpen(false);
        resetForm();
        if (!isEdit && result.doctorId) {
          router.push(`/settings/doctors/${result.doctorId}`);
        } else {
          router.refresh();
        }
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
      {!isControlled && (
        <SheetTrigger render={<Button variant={isEdit ? "outline" : "default"} className={className} />}>
          {isEdit ? <Pencil className="size-4" /> : <UserPlus className="size-4" />}
          {isEdit ? "Edit" : "Add Doctor"}
        </SheetTrigger>
      )}
      <SheetContent className="sm:max-w-lg" side="right">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Edit Doctor" : "Add Doctor"}</SheetTitle>
          <SheetDescription>
            {isEdit
              ? "Update this doctor's profile details."
              : "The doctor is added to your clinic right away. Application access stays off until you turn it on from their profile."}
          </SheetDescription>
        </SheetHeader>

        <form action={handleSubmit} className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 pb-4">
          <FormField label="Full name" htmlFor="full_name" required error={fieldErrors.full_name}>
            <Input
              id="full_name"
              name="full_name"
              defaultValue={doctor?.full_name ?? ""}
              placeholder="e.g. Dr. Karim Youssef"
              aria-invalid={!!fieldErrors.full_name}
              autoFocus
            />
          </FormField>

          <FormField label="Phone" htmlFor="phone" error={fieldErrors.phone}>
            <Input id="phone" name="phone" defaultValue={doctor?.phone ?? ""} aria-invalid={!!fieldErrors.phone} />
          </FormField>

          {!isEdit && (
            <FormField
              label="Login email"
              htmlFor="email"
              required
              description="Used only if this doctor needs application access — you can turn that on later from their profile."
              error={fieldErrors.email}
            >
              <Input id="email" name="email" type="email" placeholder="doctor@clinic.com" aria-invalid={!!fieldErrors.email} />
            </FormField>
          )}

          <FormField label="Specialty" htmlFor="specialty" error={fieldErrors.specialty}>
            <Input
              id="specialty"
              name="specialty"
              defaultValue={doctor?.specialty ?? ""}
              placeholder="e.g. Orthodontics"
              aria-invalid={!!fieldErrors.specialty}
            />
          </FormField>

          <FormField label="License number" htmlFor="license_number" error={fieldErrors.license_number}>
            <Input
              id="license_number"
              name="license_number"
              defaultValue={doctor?.license_number ?? ""}
              aria-invalid={!!fieldErrors.license_number}
            />
          </FormField>

          {isEdit && (
            <>
              <FormField label="Bio" htmlFor="bio" error={fieldErrors.bio}>
                <Textarea id="bio" name="bio" defaultValue={doctor?.bio ?? ""} rows={3} />
              </FormField>

              <div className="space-y-2">
                <Label htmlFor="color">Calendar color</Label>
                <input
                  id="color"
                  name="color"
                  type="color"
                  value={color}
                  onChange={(event) => setColor(event.target.value)}
                  className="size-9 cursor-pointer rounded border border-input bg-transparent p-0.5"
                />
              </div>
            </>
          )}

          <div className="mt-auto flex justify-end gap-2 pt-2">
            <SheetClose render={<Button type="button" variant="outline" disabled={pending} />}>Cancel</SheetClose>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              {isEdit ? "Save changes" : "Add doctor"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

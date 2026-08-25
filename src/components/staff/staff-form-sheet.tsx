"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, UserPlus } from "lucide-react";

import { inviteStaffMember } from "@/lib/staff/actions";
import { STAFF_ASSIGNABLE_ROLES, type StaffAssignableRole } from "@/lib/staff/schema";
import { useTranslation } from "@/components/locale-provider";

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
import { FormField } from "@/components/ui/form-field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function StaffFormSheet() {
  const dict = useTranslation().staff;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await inviteStaffMember(formData);

      if (result.error) {
        toast.error(result.error);
        setFieldErrors(result.fieldErrors ?? {});
      } else {
        toast.success(dict.form.invitedToast);
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
      <SheetTrigger render={<Button />}>
        <UserPlus className="size-4" />
        {dict.addStaff}
      </SheetTrigger>
      <SheetContent className="sm:max-w-lg" side="right">
        <SheetHeader>
          <SheetTitle>{dict.form.title}</SheetTitle>
          <SheetDescription>{dict.form.description}</SheetDescription>
        </SheetHeader>

        <form action={handleSubmit} className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 pb-4">
          <FormField label={dict.form.fullNameLabel} htmlFor="full_name" required error={fieldErrors.full_name}>
            <Input
              id="full_name"
              name="full_name"
              placeholder={dict.form.fullNamePlaceholder}
              aria-invalid={!!fieldErrors.full_name}
              autoFocus
            />
          </FormField>

          <FormField label={dict.form.emailLabel} htmlFor="email" required error={fieldErrors.email}>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder={dict.form.emailPlaceholder}
              aria-invalid={!!fieldErrors.email}
            />
          </FormField>

          <FormField label={dict.form.phoneLabel} htmlFor="phone" error={fieldErrors.phone}>
            <Input id="phone" name="phone" aria-invalid={!!fieldErrors.phone} />
          </FormField>

          <FormField label={dict.form.roleLabel} htmlFor="role" required error={fieldErrors.role}>
            <Select name="role" required>
              <SelectTrigger id="role" className="w-full">
                <SelectValue placeholder={dict.form.rolePlaceholder} />
              </SelectTrigger>
              <SelectContent>
                {STAFF_ASSIGNABLE_ROLES.map((role: StaffAssignableRole) => (
                  <SelectItem key={role} value={role}>
                    {dict.roles[role]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <div className="mt-auto flex justify-end gap-2 pt-2">
            <SheetClose render={<Button type="button" variant="outline" disabled={pending} />}>{dict.form.cancel}</SheetClose>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              {dict.form.submit}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

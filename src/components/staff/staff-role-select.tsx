"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { changeStaffRole } from "@/lib/staff/actions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTranslation } from "@/components/locale-provider";
import { STAFF_ASSIGNABLE_ROLES, type StaffAssignableRole } from "@/lib/staff/schema";

/** Inline role reassignment for one roster row — only ever rendered for a row already gated to an assignable role and not the signed-in staff member's own row (see StaffTable). */
export function StaffRoleSelect({ staffId, role }: { staffId: string; role: StaffAssignableRole }) {
  const dict = useTranslation().staff;
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleChange(value: string | null) {
    if (!value || value === role) return;
    startTransition(async () => {
      const result = await changeStaffRole(staffId, value);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(dict.roleChangedToast);
        router.refresh();
      }
    });
  }

  return (
    <Select value={role} onValueChange={handleChange} disabled={pending}>
      <SelectTrigger size="sm" aria-label={dict.changeRoleLabel}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {STAFF_ASSIGNABLE_ROLES.map((value) => (
          <SelectItem key={value} value={value}>
            {dict.roles[value]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

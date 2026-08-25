"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Mail, Power, PowerOff } from "lucide-react";
import { setStaffActive, resendStaffInvite } from "@/lib/staff/actions";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/components/locale-provider";
import type { StaffInvitationStatus } from "@/lib/staff/schema";

/** Same "direct action, no confirm dialog" weight as DoctorStatusActions — deactivating is reversible here too. */
export function StaffStatusActions({
  staffId,
  isActive,
  status,
}: {
  staffId: string;
  isActive: boolean;
  status: StaffInvitationStatus;
}) {
  const dict = useTranslation().staff;
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleToggle() {
    startTransition(async () => {
      const result = await setStaffActive(staffId, !isActive);
      if (result.error) {
        toast.error(result.error);
      } else {
        router.refresh();
      }
    });
  }

  function handleResend() {
    startTransition(async () => {
      const result = await resendStaffInvite(staffId);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(dict.form.invitedToast);
        router.refresh();
      }
    });
  }

  return (
    <div className="flex justify-end gap-2">
      {status === "pending" && (
        <Button variant="outline" size="sm" disabled={pending} onClick={handleResend}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}
          {dict.resendInvite}
        </Button>
      )}
      <Button variant="outline" size="sm" disabled={pending} onClick={handleToggle}>
        {pending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : isActive ? (
          <PowerOff className="size-4" />
        ) : (
          <Power className="size-4" />
        )}
        {isActive ? dict.deactivate : dict.reactivate}
      </Button>
    </div>
  );
}

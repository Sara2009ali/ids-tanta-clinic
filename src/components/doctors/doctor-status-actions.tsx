"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Power, PowerOff } from "lucide-react";
import { setDoctorActive } from "@/lib/doctors/actions";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/components/locale-provider";

/**
 * Direct action, no confirm dialog — deactivating is reversible (unlike a
 * real delete), same weight as PatientHeaderActions' Archive/Restore. The
 * toast copy spells out the access side-effect either direction —
 * deactivating also revokes login access, and reactivating deliberately
 * does NOT restore it (see setDoctorActive()'s own doc comment) — so an
 * admin is told the real state at the exact moment it matters, instead of
 * assuming roster status and login access always move together.
 */
export function DoctorStatusActions({ doctorId, isActive }: { doctorId: string; isActive: boolean }) {
  const dict = useTranslation().doctors;
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleToggle() {
    startTransition(async () => {
      const result = await setDoctorActive(doctorId, !isActive);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(isActive ? dict.deactivatedToast : dict.reactivatedToast);
        router.refresh();
      }
    });
  }

  return (
    <Button variant="outline" disabled={pending} onClick={handleToggle}>
      {pending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : isActive ? (
        <PowerOff className="size-4" />
      ) : (
        <Power className="size-4" />
      )}
      {isActive ? "Deactivate" : "Reactivate"}
    </Button>
  );
}

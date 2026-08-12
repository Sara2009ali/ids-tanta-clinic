"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Power, PowerOff } from "lucide-react";
import { setDoctorActive } from "@/lib/doctors/actions";
import { Button } from "@/components/ui/button";

/** Direct action, no confirm dialog — deactivating is reversible (unlike a real delete), same weight as PatientHeaderActions' Archive/Restore. */
export function DoctorStatusActions({ doctorId, isActive }: { doctorId: string; isActive: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleToggle() {
    startTransition(async () => {
      const result = await setDoctorActive(doctorId, !isActive);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(isActive ? "Doctor deactivated" : "Doctor reactivated");
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

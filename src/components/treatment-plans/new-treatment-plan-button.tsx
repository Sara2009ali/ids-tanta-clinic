"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createTreatmentPlan } from "@/lib/treatment-plans/actions";

/**
 * One click, no form — a title is optional and can be added later from the
 * plan workspace itself (see TreatmentPlanTitle), so asking for it upfront
 * would just be a form standing between the dentist and the thing they
 * actually want to do: start adding procedures. Creates an empty draft and
 * lands directly in the workspace, matching "create draft, immediately land
 * in the Treatment Plan workspace, add procedures from there."
 */
export function NewTreatmentPlanButton({ patientId }: { patientId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleCreate() {
    startTransition(async () => {
      const result = await createTreatmentPlan(patientId, new FormData());
      if (result.error) {
        toast.error(result.error);
      } else if (result.planId) {
        router.push(`/patients/${patientId}/treatment-plans/${result.planId}`);
      }
    });
  }

  return (
    <Button size="sm" disabled={pending} onClick={handleCreate}>
      {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
      New Treatment Plan
    </Button>
  );
}

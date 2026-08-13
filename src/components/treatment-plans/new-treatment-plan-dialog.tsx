"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { createTreatmentPlan } from "@/lib/treatment-plans/actions";

export function NewTreatmentPlanDialog({ patientId }: { patientId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [pending, startTransition] = useTransition();

  function handleCreate() {
    const formData = new FormData();
    formData.set("title", title);

    startTransition(async () => {
      const result = await createTreatmentPlan(patientId, formData);
      if (result.error) {
        toast.error(result.error);
      } else if (result.planId) {
        toast.success("Treatment plan created");
        setOpen(false);
        setTitle("");
        router.push(`/patients/${patientId}/treatment-plans/${result.planId}`);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <Plus className="size-4" />
        New Treatment Plan
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New treatment plan</DialogTitle>
          <DialogDescription>Starts as a draft — nothing is shown to the patient until you propose it.</DialogDescription>
        </DialogHeader>
        <FormField label="Title" htmlFor="new_plan_title" description="Optional — helps tell multiple plans apart later">
          <Input
            id="new_plan_title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Restorative & Periodontal Plan"
          />
        </FormField>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={pending} onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={pending} onClick={handleCreate}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            Create draft
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

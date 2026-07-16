"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addVacation, removeVacation } from "@/lib/appointments/doctor-schedule-actions";
import type { DoctorVacation } from "@/types/domain";

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

export function VacationsManager({ doctorId, vacations }: { doctorId: string; vacations: DoctorVacation[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleAdd(formData: FormData) {
    startTransition(async () => {
      const result = await addVacation(formData);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Vacation added");
        router.refresh();
      }
    });
  }

  function handleRemove(id: string) {
    startTransition(async () => {
      const result = await removeVacation(id);
      if (result.error) {
        toast.error(result.error);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {vacations.length === 0 && <p className="text-sm text-muted-foreground">No vacations scheduled.</p>}
        {vacations.map((vacation) => (
          <div
            key={vacation.id}
            className="flex items-center justify-between gap-3 rounded-lg bg-card p-2 text-sm ring-1 ring-foreground/10"
          >
            <div className="min-w-0">
              <p className="truncate font-medium">
                {formatDate(vacation.start_date)} – {formatDate(vacation.end_date)}
              </p>
              {vacation.reason && <p className="truncate text-xs text-muted-foreground">{vacation.reason}</p>}
            </div>
            <button
              type="button"
              onClick={() => handleRemove(vacation.id)}
              disabled={pending}
              className="shrink-0 text-muted-foreground hover:text-destructive disabled:pointer-events-none disabled:opacity-50"
              aria-label={`Remove vacation ${formatDate(vacation.start_date)} to ${formatDate(vacation.end_date)}`}
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}
      </div>

      <form action={handleAdd} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="doctor_id" value={doctorId} />
        <div className="space-y-1">
          <Label htmlFor="vacation_start_date" className="text-xs">
            From
          </Label>
          <Input id="vacation_start_date" type="date" name="start_date" required className="h-8" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="vacation_end_date" className="text-xs">
            To
          </Label>
          <Input id="vacation_end_date" type="date" name="end_date" required className="h-8" />
        </div>
        <div className="min-w-40 flex-1 space-y-1">
          <Label htmlFor="vacation_reason" className="text-xs">
            Reason (optional)
          </Label>
          <Input id="vacation_reason" name="reason" className="h-8" />
        </div>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          Add
        </Button>
      </form>
    </div>
  );
}

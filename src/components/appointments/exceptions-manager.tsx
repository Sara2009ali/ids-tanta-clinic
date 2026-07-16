"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addScheduleException, removeScheduleException } from "@/lib/appointments/doctor-schedule-actions";
import type { DoctorScheduleException } from "@/types/domain";

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

function minutesToLabel(minutes: number) {
  const date = new Date();
  date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/** Single-date hour overrides — e.g. a half day. Replaces the weekly template for that date only. */
export function ExceptionsManager({
  doctorId,
  exceptions,
}: {
  doctorId: string;
  exceptions: DoctorScheduleException[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleAdd(formData: FormData) {
    startTransition(async () => {
      const result = await addScheduleException(formData);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Exception added");
        router.refresh();
      }
    });
  }

  function handleRemove(id: string) {
    startTransition(async () => {
      const result = await removeScheduleException(id);
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
        {exceptions.length === 0 && <p className="text-sm text-muted-foreground">No one-off exceptions.</p>}
        {exceptions.map((exception) => (
          <div
            key={exception.id}
            className="flex items-center justify-between gap-3 rounded-lg bg-card p-2 text-sm ring-1 ring-foreground/10"
          >
            <div className="min-w-0">
              <p className="truncate font-medium">
                {formatDate(exception.exception_date)} · {minutesToLabel(exception.start_minutes)}–
                {minutesToLabel(exception.end_minutes)}
              </p>
              {exception.reason && <p className="truncate text-xs text-muted-foreground">{exception.reason}</p>}
            </div>
            <button
              type="button"
              onClick={() => handleRemove(exception.id)}
              disabled={pending}
              className="shrink-0 text-muted-foreground hover:text-destructive disabled:pointer-events-none disabled:opacity-50"
              aria-label={`Remove exception on ${formatDate(exception.exception_date)}`}
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}
      </div>

      <form action={handleAdd} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="doctor_id" value={doctorId} />
        <div className="space-y-1">
          <Label htmlFor="exception_date" className="text-xs">
            Date
          </Label>
          <Input id="exception_date" type="date" name="exception_date" required className="h-8" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="exception_start_time" className="text-xs">
            Start
          </Label>
          <Input id="exception_start_time" type="time" name="start_time" required className="h-8" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="exception_end_time" className="text-xs">
            End
          </Label>
          <Input id="exception_end_time" type="time" name="end_time" required className="h-8" />
        </div>
        <div className="min-w-40 flex-1 space-y-1">
          <Label htmlFor="exception_reason" className="text-xs">
            Reason (optional)
          </Label>
          <Input id="exception_reason" name="reason" className="h-8" />
        </div>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          Add
        </Button>
      </form>
    </div>
  );
}

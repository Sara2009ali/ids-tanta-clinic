"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addWeeklyHoursBlock, removeWeeklyHoursBlock } from "@/lib/appointments/doctor-schedule-actions";
import type { DoctorWeeklyHours } from "@/types/domain";

const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function minutesToLabel(minutes: number) {
  const date = new Date();
  date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function DayColumn({
  doctorId,
  dayOfWeek,
  blocks,
}: {
  doctorId: string;
  dayOfWeek: number;
  blocks: DoctorWeeklyHours[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleAdd(formData: FormData) {
    startTransition(async () => {
      const result = await addWeeklyHoursBlock(formData);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Block added");
        router.refresh();
      }
    });
  }

  function handleRemove(id: string) {
    startTransition(async () => {
      const result = await removeWeeklyHoursBlock(id);
      if (result.error) {
        toast.error(result.error);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <div className="flex min-h-48 flex-col gap-2 rounded-xl border border-border p-2">
      <p className="text-xs font-medium text-muted-foreground">{DAY_LABELS[dayOfWeek]}</p>
      <div className="flex flex-1 flex-col gap-1.5">
        {blocks.length === 0 && <p className="text-xs text-muted-foreground/60">Closed</p>}
        {blocks.map((block) => (
          <div
            key={block.id}
            className="flex items-center justify-between gap-1 rounded-lg bg-card px-2 py-1 text-xs ring-1 ring-foreground/10"
          >
            <span>
              {minutesToLabel(block.start_minutes)}–{minutesToLabel(block.end_minutes)}
            </span>
            <button
              type="button"
              onClick={() => handleRemove(block.id)}
              disabled={pending}
              className="text-muted-foreground hover:text-destructive disabled:pointer-events-none disabled:opacity-50"
              aria-label={`Remove ${DAY_LABELS[dayOfWeek]} ${minutesToLabel(block.start_minutes)}–${minutesToLabel(block.end_minutes)} block`}
            >
              <X className="size-3" />
            </button>
          </div>
        ))}
      </div>
      <form action={handleAdd} className="flex flex-col gap-1">
        <input type="hidden" name="doctor_id" value={doctorId} />
        <input type="hidden" name="day_of_week" value={dayOfWeek} />
        <Input type="time" name="start_time" required className="h-7 text-xs" aria-label="Start time" />
        <Input type="time" name="end_time" required className="h-7 text-xs" aria-label="End time" />
        <Button type="submit" size="sm" variant="outline" disabled={pending} className="h-7">
          {pending ? <Loader2 className="size-3 animate-spin" /> : <Plus className="size-3" />}
          Add
        </Button>
      </form>
    </div>
  );
}

/**
 * Split shifts / breaks aren't a separate concept in the UI — adding a
 * second block to the same day (e.g. 9-13 and 14-18) is how a break gets
 * represented, matching how doctor_weekly_hours is modeled in the DB.
 */
export function WeeklyHoursEditor({
  doctorId,
  weeklyHours,
}: {
  doctorId: string;
  weeklyHours: DoctorWeeklyHours[];
}) {
  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[980px] grid-cols-7 gap-2">
        {Array.from({ length: 7 }, (_, dayOfWeek) => dayOfWeek).map((dayOfWeek) => (
          <DayColumn
            key={dayOfWeek}
            doctorId={doctorId}
            dayOfWeek={dayOfWeek}
            blocks={weeklyHours
              .filter((block) => block.day_of_week === dayOfWeek)
              .sort((a, b) => a.start_minutes - b.start_minutes)}
          />
        ))}
      </div>
    </div>
  );
}

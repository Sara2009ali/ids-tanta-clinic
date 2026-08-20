"use client";

import { cn } from "@/lib/utils";
import { toothStateLabel } from "@/lib/dental-chart/calculations";
import { useTranslation } from "@/components/locale-provider";
import type { ToothCondition, ToothStatus } from "@/types/domain";

/**
 * Tailwind classes only — no illustrated tooth shape, no charting library.
 * Reuses the same semantic tokens (destructive/warning/accent/muted) every
 * other status indicator in this app already draws from, applied to a plain
 * rounded button, consistent with the "cards and badges, not a decorative
 * diagram" direction.
 */
function toothAppearance(status: ToothStatus, condition: ToothCondition | null): string {
  if (status === "missing") {
    return "border-dashed border-border bg-transparent text-muted-foreground/50";
  }
  if (status === "unerupted") {
    return "border-dotted border-border bg-transparent text-muted-foreground";
  }
  if (condition === "caries") {
    return "border-destructive/40 bg-destructive/10 text-destructive";
  }
  if (condition === "watch") {
    return "border-warning/40 bg-warning/15 text-warning-text";
  }
  if (condition === "filling" || condition === "crown" || condition === "root_canal" || condition === "other") {
    return "border-accent-foreground/20 bg-accent text-accent-foreground";
  }
  return "border-border bg-popover text-foreground hover:bg-muted";
}

export function Tooth({
  fdiNumber,
  status,
  condition,
  hasPlanned,
  selected,
  onSelect,
}: {
  fdiNumber: number;
  status: ToothStatus;
  condition: ToothCondition | null;
  hasPlanned: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  const { dentalChart: dict } = useTranslation();
  const label = toothStateLabel(status, condition, {
    status: dict.toothStatus,
    condition: dict.toothCondition,
    presentNoCondition: dict.presentNoCondition,
  });

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={`${dict.toothAriaPrefix} ${fdiNumber} — ${label}${hasPlanned ? dict.treatmentPlannedSuffix : ""}`}
      aria-pressed={selected}
      className={cn(
        "relative flex size-9 shrink-0 items-center justify-center rounded-lg border text-xs font-medium tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:size-10",
        toothAppearance(status, condition),
        selected && "ring-2 ring-ring ring-offset-2 ring-offset-background",
      )}
    >
      {fdiNumber}
      {hasPlanned && (
        <span
          className="absolute -top-1 -right-1 size-2.5 rounded-full border-2 border-background bg-primary"
          aria-hidden="true"
        />
      )}
    </button>
  );
}

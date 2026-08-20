"use client";

import { useState } from "react";
import { Tooth } from "@/components/dental-chart/tooth";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/components/locale-provider";
import type { Dictionary } from "@/lib/i18n/types";
import type { DentalChartToothSummary } from "@/lib/dental-chart/queries";
import type { ToothDentition } from "@/types/domain";

// Standard two-row FDI chart layout: patient's right on the viewer's left
// (the same orientation dentists chart in), upper-right above lower-right so
// the two arches line up vertically tooth-for-tooth. Literal, not derived —
// easy to eyeball against the real FDI grid, verified against
// PERMANENT_FDI_NUMBERS/PRIMARY_FDI_NUMBERS in calculations.test.ts.
const PERMANENT_UPPER = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
const PERMANENT_LOWER = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];
const PRIMARY_UPPER = [55, 54, 53, 52, 51, 61, 62, 63, 64, 65];
const PRIMARY_LOWER = [85, 84, 83, 82, 81, 71, 72, 73, 74, 75];

function ToothLegend({ dict }: { dict: Dictionary["dentalChart"] }) {
  const items: { swatch: string; label: string }[] = [
    { swatch: "border-destructive/40 bg-destructive/10", label: dict.legend.caries },
    { swatch: "border-warning/40 bg-warning/15", label: dict.legend.watch },
    { swatch: "border-accent-foreground/20 bg-accent", label: dict.legend.existingWork },
    { swatch: "border-dashed border-border bg-transparent", label: dict.legend.missing },
  ];
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
      {items.map((item) => (
        <span key={item.label} className="inline-flex items-center gap-1.5">
          <span className={cn("size-2.5 rounded-sm border", item.swatch)} aria-hidden="true" />
          {item.label}
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5">
        <span className="size-2 rounded-full bg-primary" aria-hidden="true" />
        {dict.legend.planned}
      </span>
    </div>
  );
}

const DEFAULT_SUMMARY = (fdiNumber: number): DentalChartToothSummary => ({
  fdiNumber,
  status: "present",
  condition: null,
  hasPlanned: false,
});

const DENTITION_STORAGE_KEY_PREFIX = "dentra:dental-chart:dentition:";

/** Base UI's Tabs unmounts inactive panels, so this component remounts every time the Dental Chart tab is left and reopened — sessionStorage (scoped per patient, per browser tab) is what keeps "which dentition was I looking at" from silently resetting to Permanent on every remount. */
function readStoredDentition(patientId: string): ToothDentition {
  if (typeof window === "undefined") return "permanent";
  return window.sessionStorage.getItem(DENTITION_STORAGE_KEY_PREFIX + patientId) === "primary" ? "primary" : "permanent";
}

/**
 * The chairside odontogram — two arches, quadrant-ordered, scannable at a
 * glance. Every tooth is a real <button> (keyboard-reachable, labeled), not
 * a bare clickable shape, per the accessibility requirement. Rows scroll
 * horizontally on narrow viewports rather than shrinking tooth targets below
 * a comfortable tap size.
 */
export function Odontogram({
  patientId,
  teeth,
  selectedFdiNumber,
  onSelectTooth,
}: {
  patientId: string;
  teeth: DentalChartToothSummary[];
  selectedFdiNumber: number | null;
  onSelectTooth: (fdiNumber: number) => void;
}) {
  const { dentalChart: dict } = useTranslation();
  const [dentition, setDentitionState] = useState<ToothDentition>(() => readStoredDentition(patientId));

  function setDentition(value: ToothDentition) {
    setDentitionState(value);
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(DENTITION_STORAGE_KEY_PREFIX + patientId, value);
    }
  }

  const byFdi = new Map(teeth.map((tooth) => [tooth.fdiNumber, tooth]));
  const upper = dentition === "permanent" ? PERMANENT_UPPER : PRIMARY_UPPER;
  const lower = dentition === "permanent" ? PERMANENT_LOWER : PRIMARY_LOWER;

  function renderRow(fdiNumbers: number[], label: string) {
    return (
      <div className="overflow-x-auto pb-1" role="group" aria-label={label}>
        {/* dir="ltr" is deliberate and load-bearing, not a default: this row
            is the real clinical dentition layout (patient's right charted on
            the viewer's left — see the FDI array comment above), and it must
            never mirror when the page is RTL. Only the surrounding chrome
            (legend, toggle, labels) follows the document direction. */}
        <div dir="ltr" className="flex w-max min-w-full justify-center gap-1 sm:gap-1.5">
          {fdiNumbers.map((fdiNumber) => {
            const summary = byFdi.get(fdiNumber) ?? DEFAULT_SUMMARY(fdiNumber);
            return (
              <Tooth
                key={fdiNumber}
                fdiNumber={summary.fdiNumber}
                status={summary.status}
                condition={summary.condition}
                hasPlanned={summary.hasPlanned}
                selected={selectedFdiNumber === fdiNumber}
                onSelect={() => onSelectTooth(fdiNumber)}
              />
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-border p-0.5" role="group" aria-label={dict.dentitionToggleLabel}>
          {(["permanent", "primary"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setDentition(value)}
              aria-pressed={dentition === value}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                dentition === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {dict.dentition[value]}
            </button>
          ))}
        </div>
        <ToothLegend dict={dict} />
      </div>

      <div className="space-y-3">
        {renderRow(upper, dict.arch.upper)}
        {renderRow(lower, dict.arch.lower)}
      </div>
    </div>
  );
}

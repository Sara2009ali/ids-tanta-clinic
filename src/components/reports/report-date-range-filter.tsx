"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buildReportsRangeHref } from "@/components/reports/reports-query-params";

/**
 * The one genuinely new filter primitive this module needs (per the
 * approved architecture — every other filter reuses an existing `Select`
 * pattern). Uncontrolled inputs keyed on the current range so a
 * server-driven range change (e.g. browser back/forward) resets the
 * displayed dates via remount, without needing the "sync local state on
 * prop change" dance CompensationRulesFilters' debounced search box needs
 * — a plain date input has no debounce/typing-buffer to protect.
 */
export function ReportDateRangeFilter({
  basePath,
  value,
}: {
  basePath: string;
  value: { start: string; end: string };
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  function navigate(updates: { from?: string; to?: string }) {
    const href = buildReportsRangeHref(basePath, { from: value.start, to: value.end }, updates);
    startTransition(() => {
      router.push(href, { scroll: false });
    });
  }

  return (
    <div className="flex flex-wrap items-end gap-3" key={`${value.start}_${value.end}`}>
      <div className="space-y-1.5">
        <Label htmlFor="report-from">From</Label>
        <Input
          id="report-from"
          type="date"
          defaultValue={value.start}
          max={value.end}
          onChange={(event) => navigate({ from: event.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="report-to">To</Label>
        <Input
          id="report-to"
          type="date"
          defaultValue={value.end}
          min={value.start}
          onChange={(event) => navigate({ to: event.target.value })}
        />
      </div>
    </div>
  );
}

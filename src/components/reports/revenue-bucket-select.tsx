"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { RevenueBucketGranularity } from "@/lib/reports/queries";

const BUCKET_LABELS: Record<RevenueBucketGranularity, string> = {
  day: "Daily",
  week: "Weekly",
  month: "Monthly",
  year: "Yearly",
};

/** bucket is specific to the Revenue report, unlike from/to (shared across every report page) — kept out of reports-query-params.ts on purpose rather than overloading that generic helper with a param only one page uses. */
export function RevenueBucketSelect({
  range,
  value,
}: {
  range: { start: string; end: string };
  value: RevenueBucketGranularity;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  function navigate(bucket: string) {
    const params = new URLSearchParams({ from: range.start, to: range.end, bucket });
    startTransition(() => {
      router.push(`/reports/revenue?${params.toString()}`, { scroll: false });
    });
  }

  return (
    <Select value={value} onValueChange={(v) => v && navigate(v)}>
      <SelectTrigger className="w-36">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {(Object.keys(BUCKET_LABELS) as RevenueBucketGranularity[]).map((bucket) => (
          <SelectItem key={bucket} value={bucket}>
            {BUCKET_LABELS[bucket]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

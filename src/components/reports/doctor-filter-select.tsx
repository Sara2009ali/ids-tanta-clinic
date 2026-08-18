"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { buildReportsRangeHref, type ReportsRangeParams } from "@/components/reports/reports-query-params";
import type { DoctorOption } from "@/lib/patients/queries";

const ALL_VALUE = "all";

/**
 * Shared doctor scope filter for the three Advanced Clinical Reports pages
 * (Clinical Activity, Recalls — Treatment Plans has no doctor dimension in
 * its schema, so it doesn't use this). Preserves from/to via
 * buildReportsRangeHref exactly like ReportDateRangeFilter's own
 * navigation, just adding `doctor` to the querystring. Renders nothing when
 * the clinic has no doctors yet, same "hide instead of showing an empty
 * picker" convention used elsewhere (e.g. InvoiceFormSheet's visitTypes).
 */
export function DoctorFilterSelect({
  basePath,
  value,
  doctors,
}: {
  basePath: string;
  value: ReportsRangeParams;
  doctors: DoctorOption[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  if (doctors.length === 0) return null;

  const items: Record<string, string> = {
    [ALL_VALUE]: "All doctors",
    ...Object.fromEntries(doctors.map((doctor) => [doctor.id, `Dr. ${doctor.full_name}`])),
  };

  function navigate(doctorId: string | null) {
    const href = buildReportsRangeHref(basePath, value, {
      doctor: !doctorId || doctorId === ALL_VALUE ? undefined : doctorId,
    });
    startTransition(() => {
      router.push(href, { scroll: false });
    });
  }

  return (
    <Select items={items} value={value.doctor || ALL_VALUE} onValueChange={navigate}>
      <SelectTrigger className="w-full sm:w-44">
        <SelectValue placeholder="Doctor" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_VALUE}>All doctors</SelectItem>
        {doctors.map((doctor) => (
          <SelectItem key={doctor.id} value={doctor.id}>
            Dr. {doctor.full_name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

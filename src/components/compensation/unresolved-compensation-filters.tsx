"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { DoctorOption } from "@/lib/patients/queries";
import {
  buildUnresolvedCompensationHref,
  type UnresolvedCompensationQueryParams,
} from "@/components/compensation/unresolved-compensation-query-params";

const ALL_VALUE = "all";

export function UnresolvedCompensationFilters({
  value,
  doctors,
}: {
  value: UnresolvedCompensationQueryParams;
  doctors: DoctorOption[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  function navigate(updates: UnresolvedCompensationQueryParams) {
    const href = buildUnresolvedCompensationHref(value, updates);
    startTransition(() => {
      router.push(href, { scroll: false });
    });
  }

  return (
    <Select
      items={{ [ALL_VALUE]: "All doctors", ...Object.fromEntries(doctors.map((d) => [d.id, `Dr. ${d.full_name}`])) }}
      value={value.doctorId || ALL_VALUE}
      onValueChange={(v) => navigate({ doctorId: !v || v === ALL_VALUE ? undefined : v })}
    >
      <SelectTrigger className="w-full sm:w-48">
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

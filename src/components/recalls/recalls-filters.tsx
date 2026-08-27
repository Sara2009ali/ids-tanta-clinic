"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SearchInput } from "@/components/ui/search-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RECALL_STATUS_LABELS, type RecallStatus } from "@/types/domain";
import { buildRecallsHref, type RecallsQueryParams } from "@/components/recalls/recalls-query-params";
import type { DoctorOption } from "@/lib/patients/queries";

const ALL_VALUE = "all";
const SEARCH_DEBOUNCE_MS = 300;

const STATUS_OPTIONS: { value: RecallStatus; label: string }[] = (
  Object.keys(RECALL_STATUS_LABELS) as RecallStatus[]
).map((value) => ({ value, label: RECALL_STATUS_LABELS[value] }));

const STATUS_ITEMS: Record<string, string> = {
  [ALL_VALUE]: "All statuses",
  ...Object.fromEntries(STATUS_OPTIONS.map((o) => [o.value, o.label])),
};

/** Same shape as InvoicesFilters: debounced text search (reason), status Select, plus a doctor Select — no overdue filter (see recalls-query-params.ts). */
export function RecallsFilters({ value, doctors }: { value: RecallsQueryParams; doctors: DoctorOption[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [priorQuery, setPriorQuery] = useState(value.query ?? "");
  const [searchText, setSearchText] = useState(value.query ?? "");
  if (priorQuery !== (value.query ?? "")) {
    setPriorQuery(value.query ?? "");
    setSearchText(value.query ?? "");
  }

  const doctorItems: Record<string, string> = {
    [ALL_VALUE]: "All doctors",
    ...Object.fromEntries(doctors.map((d) => [d.id, `Dr. ${d.full_name}`])),
  };

  function navigate(updates: RecallsQueryParams) {
    const href = buildRecallsHref(value, { page: undefined, ...updates });
    startTransition(() => {
      router.push(href, { scroll: false });
    });
  }

  function handleSearchChange(event: React.ChangeEvent<HTMLInputElement>) {
    const next = event.target.value;
    setSearchText(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      navigate({ query: next || undefined });
    }, SEARCH_DEBOUNCE_MS);
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-2">
      <SearchInput
        value={searchText}
        onChange={handleSearchChange}
        placeholder="Search by reason..."
        className="sm:min-w-56 sm:max-w-sm sm:flex-1"
      />

      <Select
        items={STATUS_ITEMS}
        value={value.status || ALL_VALUE}
        onValueChange={(v) => navigate({ status: !v || v === ALL_VALUE ? undefined : v })}
      >
        <SelectTrigger className="w-full sm:w-40">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_VALUE}>All statuses</SelectItem>
          {STATUS_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {doctors.length > 0 && (
        <Select
          items={doctorItems}
          value={value.doctor || ALL_VALUE}
          onValueChange={(v) => navigate({ doctor: !v || v === ALL_VALUE ? undefined : v })}
        >
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
      )}
    </div>
  );
}

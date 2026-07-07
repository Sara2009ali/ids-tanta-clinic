"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PATIENT_STATUS_LABELS, type PatientStatus } from "@/types/domain";
import type { DoctorOption } from "@/lib/patients/queries";
import { buildPatientsHref, type PatientsQueryParams } from "@/components/patients/patients-query-params";

const ALL_VALUE = "all";
const SEARCH_DEBOUNCE_MS = 300;

const GENDER_OPTIONS: { value: string; label: string }[] = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
  { value: "unspecified", label: "Unspecified" },
];

const STATUS_OPTIONS: { value: PatientStatus; label: string }[] = (
  Object.keys(PATIENT_STATUS_LABELS) as PatientStatus[]
).map((value) => ({ value, label: PATIENT_STATUS_LABELS[value] }));

export function PatientsFilters({
  value,
  doctors,
}: {
  value: PatientsQueryParams;
  doctors: DoctorOption[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep the search box's local text in sync when the query changes for a reason
  // other than our own debounced navigation (e.g. "Clear filters" or browser back/forward).
  // This adjusts state during render, per React's guidance, rather than in a useEffect.
  const [priorQuery, setPriorQuery] = useState(value.query ?? "");
  const [searchText, setSearchText] = useState(value.query ?? "");
  if (priorQuery !== (value.query ?? "")) {
    setPriorQuery(value.query ?? "");
    setSearchText(value.query ?? "");
  }

  function navigate(updates: PatientsQueryParams) {
    const href = buildPatientsHref(value, { page: undefined, ...updates });
    startTransition(() => {
      router.push(href, { scroll: false });
    });
  }

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.target.value;
    setSearchText(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      navigate({ query: next || undefined });
    }, SEARCH_DEBOUNCE_MS);
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-2">
      <div className="relative sm:max-w-xs sm:flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchText}
          onChange={handleSearchChange}
          placeholder="Search by name, phone, number, or notes..."
          className="pl-9"
        />
      </div>

      <Select
        value={value.gender || ALL_VALUE}
        onValueChange={(v) => navigate({ gender: !v || v === ALL_VALUE ? undefined : v })}
      >
        <SelectTrigger className="w-full sm:w-40">
          <SelectValue placeholder="Gender" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_VALUE}>All genders</SelectItem>
          {GENDER_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
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

      <Select
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
              {doctor.full_name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

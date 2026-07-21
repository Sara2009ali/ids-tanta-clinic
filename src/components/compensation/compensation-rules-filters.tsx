"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { COMPENSATION_RULE_TYPE_LABELS, type CompensationRuleType } from "@/types/domain";
import type { DoctorOption } from "@/lib/patients/queries";
import type { VisitType } from "@/types/domain";
import {
  buildCompensationRulesHref,
  DOCTOR_FILTER_CLINIC_WIDE,
  VISIT_TYPE_FILTER_ALL_PROCEDURES,
  type CompensationRulesQueryParams,
} from "@/components/compensation/compensation-rules-query-params";

const ALL_VALUE = "all";
const SEARCH_DEBOUNCE_MS = 300;

const RULE_TYPE_OPTIONS = (Object.keys(COMPENSATION_RULE_TYPE_LABELS) as CompensationRuleType[]).map((value) => ({
  value,
  label: COMPENSATION_RULE_TYPE_LABELS[value],
}));

export function CompensationRulesFilters({
  value,
  doctors,
  visitTypes,
}: {
  value: CompensationRulesQueryParams;
  doctors: DoctorOption[];
  visitTypes: VisitType[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Same pattern as InvoicesFilters: keep the search box's local text in sync
  // when the query changes for a reason other than our own debounced
  // navigation (e.g. browser back/forward), adjusted during render rather
  // than in a useEffect.
  const [priorQuery, setPriorQuery] = useState(value.query ?? "");
  const [searchText, setSearchText] = useState(value.query ?? "");
  if (priorQuery !== (value.query ?? "")) {
    setPriorQuery(value.query ?? "");
    setSearchText(value.query ?? "");
  }

  function navigate(updates: CompensationRulesQueryParams) {
    const href = buildCompensationRulesHref(value, updates);
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
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
      <div className="relative sm:max-w-xs sm:flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchText}
          onChange={handleSearchChange}
          placeholder="Search by doctor or procedure..."
          className="pl-9"
        />
      </div>

      <Select
        value={value.doctorId || ALL_VALUE}
        onValueChange={(v) => navigate({ doctorId: !v || v === ALL_VALUE ? undefined : v })}
      >
        <SelectTrigger className="w-full sm:w-48">
          <SelectValue placeholder="Doctor" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_VALUE}>All doctors</SelectItem>
          <SelectItem value={DOCTOR_FILTER_CLINIC_WIDE}>Clinic-wide only</SelectItem>
          {doctors.map((doctor) => (
            <SelectItem key={doctor.id} value={doctor.id}>
              Dr. {doctor.full_name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={value.visitTypeId || ALL_VALUE}
        onValueChange={(v) => navigate({ visitTypeId: !v || v === ALL_VALUE ? undefined : v })}
      >
        <SelectTrigger className="w-full sm:w-48">
          <SelectValue placeholder="Procedure" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_VALUE}>All procedures</SelectItem>
          <SelectItem value={VISIT_TYPE_FILTER_ALL_PROCEDURES}>Applies to every procedure</SelectItem>
          {visitTypes.map((visitType) => (
            <SelectItem key={visitType.id} value={visitType.id}>
              {visitType.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={value.type || ALL_VALUE} onValueChange={(v) => navigate({ type: !v || v === ALL_VALUE ? undefined : v })}>
        <SelectTrigger className="w-full sm:w-40">
          <SelectValue placeholder="Type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_VALUE}>All types</SelectItem>
          {RULE_TYPE_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

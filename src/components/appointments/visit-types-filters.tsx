"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { buildVisitTypesHref, type VisitTypesQueryParams } from "@/components/appointments/visit-types-query-params";

const ALL_VALUE = "all";
const SEARCH_DEBOUNCE_MS = 300;

export function VisitTypesFilters({ value }: { value: VisitTypesQueryParams }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Same pattern as CompensationRulesFilters/InvoicesFilters: keep the
  // search box's local text in sync when the query changes for a reason
  // other than our own debounced navigation (e.g. browser back/forward).
  const [priorQuery, setPriorQuery] = useState(value.query ?? "");
  const [searchText, setSearchText] = useState(value.query ?? "");
  if (priorQuery !== (value.query ?? "")) {
    setPriorQuery(value.query ?? "");
    setSearchText(value.query ?? "");
  }

  function navigate(updates: VisitTypesQueryParams) {
    const href = buildVisitTypesHref(value, updates);
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
      <div className="relative sm:max-w-xs sm:flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchText}
          onChange={handleSearchChange}
          placeholder="Search procedures..."
          className="pl-9"
        />
      </div>

      <Select
        value={value.status || ALL_VALUE}
        onValueChange={(v) => navigate({ status: !v || v === ALL_VALUE ? undefined : (v as "active" | "inactive") })}
      >
        <SelectTrigger className="w-full sm:w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_VALUE}>All statuses</SelectItem>
          <SelectItem value="active">Active</SelectItem>
          <SelectItem value="inactive">Disabled</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

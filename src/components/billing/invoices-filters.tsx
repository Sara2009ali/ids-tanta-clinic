"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SearchInput } from "@/components/ui/search-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { INVOICE_STATUS_LABELS, type InvoiceStatus } from "@/types/domain";
import { buildInvoicesHref, type InvoicesQueryParams } from "@/components/billing/invoices-query-params";

const ALL_VALUE = "all";
const SEARCH_DEBOUNCE_MS = 300;

const STATUS_OPTIONS: { value: InvoiceStatus; label: string }[] = (
  Object.keys(INVOICE_STATUS_LABELS) as InvoiceStatus[]
).map((value) => ({ value, label: INVOICE_STATUS_LABELS[value] }));

const STATUS_ITEMS: Record<string, string> = {
  [ALL_VALUE]: "All statuses",
  ...Object.fromEntries(STATUS_OPTIONS.map((o) => [o.value, o.label])),
};

export function InvoicesFilters({ value }: { value: InvoicesQueryParams }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Same pattern as PatientsFilters: keep the search box's local text in
  // sync when the query changes for a reason other than our own debounced
  // navigation (e.g. browser back/forward), adjusted during render per
  // React's guidance rather than in a useEffect.
  const [priorQuery, setPriorQuery] = useState(value.query ?? "");
  const [searchText, setSearchText] = useState(value.query ?? "");
  if (priorQuery !== (value.query ?? "")) {
    setPriorQuery(value.query ?? "");
    setSearchText(value.query ?? "");
  }

  function navigate(updates: InvoicesQueryParams) {
    const href = buildInvoicesHref(value, { page: undefined, ...updates });
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
        placeholder="Search by invoice number..."
        className="sm:min-w-56 sm:max-w-sm sm:flex-1"
      />

      <Select
        items={STATUS_ITEMS}
        value={value.status || ALL_VALUE}
        onValueChange={(v) => navigate({ status: !v || v === ALL_VALUE ? undefined : v })}
      >
        <SelectTrigger className="w-full sm:w-44">
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
    </div>
  );
}

"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { searchPatientsAction } from "@/lib/appointments/patient-search-action";
import type { PatientSearchRow } from "@/types/domain";
import { Input } from "@/components/ui/input";

const SEARCH_DEBOUNCE_MS = 300;

/**
 * Front-desk "find a patient fast" search — reuses the exact same
 * searchPatientsAction/searchPatients backend as PatientPicker (inside the
 * booking sheet), but a distinct component: PatientPicker selects a
 * patient *into a form field*, this one navigates straight to the
 * patient's profile. Doesn't touch PatientPicker or the booking flow.
 */
export function QuickPatientSearch() {
  const router = useRouter();
  const [searchText, setSearchText] = useState("");
  const [results, setResults] = useState<PatientSearchRow[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, startSearchTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function runSearch(query: string) {
    startSearchTransition(async () => {
      const { rows } = await searchPatientsAction(query);
      setResults(rows);
    });
  }

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const next = event.target.value;
    setSearchText(next);
    setOpen(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!next) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(() => runSearch(next), SEARCH_DEBOUNCE_MS);
  }

  function handleSelect(row: PatientSearchRow) {
    setOpen(false);
    setSearchText("");
    setResults([]);
    router.push(`/patients/${row.id}`);
  }

  return (
    <div
      className="relative"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) {
          setOpen(false);
        }
      }}
    >
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchText}
          onChange={handleChange}
          onFocus={() => setOpen(true)}
          placeholder="Find a patient…"
          className="pl-9 sm:w-72"
        />
      </div>

      {open && searchText.length > 0 && (
        <div className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-md">
          {searching && <p className="px-2 py-1.5 text-sm text-muted-foreground">Searching…</p>}
          {!searching && results.length === 0 && (
            <p className="px-2 py-1.5 text-sm text-muted-foreground">No patients found.</p>
          )}
          {!searching &&
            results.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => handleSelect(row)}
                className="flex w-full flex-col items-start rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
              >
                <span>{row.full_name}</span>
                {row.phone && <span className="text-xs text-muted-foreground">{row.phone}</span>}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

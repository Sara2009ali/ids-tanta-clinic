"use client";

import { useRef, useState, useTransition } from "react";
import { Loader2, Search, UserPlus, X } from "lucide-react";
import { toast } from "sonner";

import { createPatient } from "@/lib/patients/actions";
import { searchPatientsAction } from "@/lib/appointments/patient-search-action";
import type { PatientSearchRow } from "@/types/domain";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const SEARCH_DEBOUNCE_MS = 300;

export interface SelectedPatient {
  id: string;
  full_name: string;
}

export function PatientPicker({
  value,
  onChange,
  error,
}: {
  value: SelectedPatient | null;
  onChange: (patient: SelectedPatient | null) => void;
  error?: string;
}) {
  const [searchText, setSearchText] = useState("");
  const [results, setResults] = useState<PatientSearchRow[]>([]);
  const [open, setOpen] = useState(false);
  const [showNewPatientForm, setShowNewPatientForm] = useState(false);
  const [searching, startSearchTransition] = useTransition();
  const [creating, startCreateTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function runSearch(query: string) {
    startSearchTransition(async () => {
      const { rows } = await searchPatientsAction(query);
      setResults(rows);
    });
  }

  function handleSearchChange(event: React.ChangeEvent<HTMLInputElement>) {
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
    onChange({ id: row.id, full_name: row.full_name });
    setOpen(false);
    setSearchText("");
    setResults([]);
  }

  function handleClear() {
    onChange(null);
    setSearchText("");
    setResults([]);
  }

  function handleCreatePatient(formData: FormData) {
    startCreateTransition(async () => {
      const result = await createPatient(formData);
      if (result.error) {
        toast.error(result.error);
      } else if (result.patientId) {
        const firstName = String(formData.get("first_name") ?? "").trim();
        const lastName = String(formData.get("last_name") ?? "").trim();
        toast.success("Patient created");
        onChange({ id: result.patientId, full_name: `${firstName} ${lastName}`.trim() });
        setShowNewPatientForm(false);
      }
    });
  }

  return (
    <div className="space-y-2">
      <input type="hidden" name="patient_id" value={value?.id ?? ""} />

      {value ? (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-2.5 py-1.5 dark:bg-input/30">
          <span className="text-sm">{value.full_name}</span>
          <Button type="button" variant="ghost" size="icon-sm" onClick={handleClear}>
            <X className="size-4" />
            <span className="sr-only">Clear selected patient</span>
          </Button>
        </div>
      ) : showNewPatientForm ? (
        <div className="space-y-2 rounded-lg border border-input p-3">
          <form action={handleCreatePatient} className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <Input name="first_name" placeholder="First name" required />
              <Input name="last_name" placeholder="Last name" required />
            </div>
            <Input name="phone" type="tel" placeholder="Phone (optional)" />
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={creating}>
                {creating && <Loader2 className="size-4 animate-spin" />}
                Create patient
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={creating}
                onClick={() => setShowNewPatientForm(false)}
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>
      ) : (
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
              onChange={handleSearchChange}
              onFocus={() => setOpen(true)}
              placeholder="Search by name or phone..."
              className="pl-9"
              aria-invalid={!!error}
            />
          </div>

          {open && searchText.length > 0 && (
            <div className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-elevation-high">
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

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-2"
            onClick={() => setShowNewPatientForm(true)}
          >
            <UserPlus className="size-4" />
            New Patient
          </Button>
        </div>
      )}

      {error && !value && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

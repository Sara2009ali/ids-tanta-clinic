"use client";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PERMANENT_FDI_NUMBERS, PRIMARY_FDI_NUMBERS } from "@/lib/dental-chart/calculations";

const NO_TOOTH = "__none__";

/**
 * Shared structured-tooth picker — used by the Treatment Plan item Dialog
 * and the Treatment Record forms (see approved integration sections F/G).
 * Deliberately a flat FDI list, not the full odontogram: picking a single
 * tooth for a plan item or record is a quick "which tooth" decision, not a
 * chairside chart-scanning task — that's what the odontogram itself is for.
 */
export function ToothSelect({
  id,
  value,
  onValueChange,
}: {
  id?: string;
  value: number | null;
  onValueChange: (fdiNumber: number | null) => void;
}) {
  function handleChange(next: string | null) {
    if (!next || next === NO_TOOTH) {
      onValueChange(null);
      return;
    }
    onValueChange(Number(next));
  }

  return (
    <Select
      items={{
        [NO_TOOTH]: "No specific tooth",
        ...Object.fromEntries(PERMANENT_FDI_NUMBERS.map((fdi) => [String(fdi), String(fdi)])),
        ...Object.fromEntries(PRIMARY_FDI_NUMBERS.map((fdi) => [String(fdi), String(fdi)])),
      }}
      value={value === null ? NO_TOOTH : String(value)}
      onValueChange={handleChange}
    >
      <SelectTrigger id={id} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NO_TOOTH}>No specific tooth</SelectItem>
        <SelectSeparator />
        <SelectGroup>
          <SelectLabel>Permanent</SelectLabel>
          {PERMANENT_FDI_NUMBERS.map((fdi) => (
            <SelectItem key={fdi} value={String(fdi)}>
              {fdi}
            </SelectItem>
          ))}
        </SelectGroup>
        <SelectGroup>
          <SelectLabel>Primary</SelectLabel>
          {PRIMARY_FDI_NUMBERS.map((fdi) => (
            <SelectItem key={fdi} value={String(fdi)}>
              {fdi}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * A text input with a leading search icon, positioned with logical
 * (start/end) utilities so it renders on the correct side in both LTR and
 * RTL — mirrors the pattern already used by quick-patient-search.tsx and
 * patient-picker.tsx. `className` styles the wrapper (for width/flex
 * sizing at the call site, same as those two components' outer div);
 * every other prop forwards straight to the underlying Input.
 */
export function SearchInput({ className, ...props }: React.ComponentProps<typeof Input>) {
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input {...props} className="ps-9" />
    </div>
  );
}

"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { buildProductsHref, type ProductsQueryParams } from "@/components/inventory/products-query-params";
import type { InventoryCategory } from "@/types/domain";

const ALL_VALUE = "all";
const SEARCH_DEBOUNCE_MS = 300;

export function ProductsFilters({ value, categories }: { value: ProductsQueryParams; categories: InventoryCategory[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [priorQuery, setPriorQuery] = useState(value.query ?? "");
  const [searchText, setSearchText] = useState(value.query ?? "");
  if (priorQuery !== (value.query ?? "")) {
    setPriorQuery(value.query ?? "");
    setSearchText(value.query ?? "");
  }

  function navigate(updates: ProductsQueryParams) {
    const href = buildProductsHref(value, updates);
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
      <div className="relative sm:min-w-56 sm:max-w-sm sm:flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={searchText} onChange={handleSearchChange} placeholder="Search products..." className="pl-9" />
      </div>

      <Select
        items={{ [ALL_VALUE]: "All categories", ...Object.fromEntries(categories.map((c) => [c.id, c.name])) }}
        value={value.categoryId || ALL_VALUE}
        onValueChange={(v) => navigate({ categoryId: !v || v === ALL_VALUE ? undefined : v })}
      >
        <SelectTrigger className="w-full sm:w-48">
          <SelectValue placeholder="Category" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_VALUE}>All categories</SelectItem>
          {categories.map((category) => (
            <SelectItem key={category.id} value={category.id}>
              {category.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        items={{ [ALL_VALUE]: "All statuses", active: "Active", inactive: "Disabled" }}
        value={value.status || ALL_VALUE}
        onValueChange={(v) => navigate({ status: !v || v === ALL_VALUE ? undefined : (v as "active" | "inactive") })}
      >
        <SelectTrigger className="w-full sm:w-40">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_VALUE}>All statuses</SelectItem>
          <SelectItem value="active">Active</SelectItem>
          <SelectItem value="inactive">Disabled</SelectItem>
        </SelectContent>
      </Select>

      <Select
        items={{ [ALL_VALUE]: "All stock levels", "1": "Low stock only" }}
        value={value.lowStock ?? ALL_VALUE}
        onValueChange={(v) => navigate({ lowStock: !v || v === ALL_VALUE ? undefined : "1" })}
      >
        <SelectTrigger className="w-full sm:w-40">
          <SelectValue placeholder="Stock" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_VALUE}>All stock levels</SelectItem>
          <SelectItem value="1">Low stock only</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

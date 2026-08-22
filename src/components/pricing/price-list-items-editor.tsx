"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Loader2, RotateCcw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { setPriceListItem } from "@/lib/pricing/actions";
import { formatCurrency } from "@/lib/billing/format";
import type { VisitType } from "@/types/domain";
import type { Dictionary } from "@/lib/i18n/types";

function PriceListItemRow({
  visitType,
  priceListId,
  override,
  dict,
}: {
  visitType: VisitType;
  priceListId: string;
  override: number | undefined;
  dict: Dictionary["priceLists"]["detail"];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState(override != null ? String(override) : "");

  function submit(nextValue: string) {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("price", nextValue);
      const result = await setPriceListItem(priceListId, visitType.id, formData);
      if (result.error) {
        toast.error(result.error);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ backgroundColor: visitType.color }} />
          {visitType.name}
        </div>
      </TableCell>
      <TableCell className="text-muted-foreground tabular-nums">{formatCurrency(Number(visitType.price))}</TableCell>
      <TableCell>
        <div className="flex items-center gap-1.5">
          <Input
            type="number"
            min={0}
            step={0.01}
            value={value}
            placeholder={dict.overridePlaceholder}
            onChange={(event) => setValue(event.target.value)}
            disabled={pending}
            aria-label={visitType.name}
            className="h-8 w-28"
          />
          <Button
            size="icon-sm"
            variant="ghost"
            disabled={pending || value === (override != null ? String(override) : "")}
            onClick={() => submit(value)}
            aria-label={dict.usingNormalPrice}
          >
            {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
          </Button>
          {override != null && (
            <Button
              size="icon-sm"
              variant="ghost"
              disabled={pending}
              onClick={() => {
                setValue("");
                submit("");
              }}
              aria-label={dict.resetToNormal}
              title={dict.resetToNormal}
            >
              <RotateCcw className="size-3.5" />
            </Button>
          )}
        </div>
        {override == null && <p className="mt-1 text-xs text-muted-foreground">{dict.usingNormalPrice}</p>}
      </TableCell>
    </TableRow>
  );
}

export function PriceListItemsEditor({
  priceListId,
  visitTypes,
  overrides,
  dict,
}: {
  priceListId: string;
  visitTypes: VisitType[];
  overrides: Record<string, number>;
  dict: Dictionary["priceLists"]["detail"];
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{dict.serviceColumn}</TableHead>
          <TableHead>{dict.normalPriceColumn}</TableHead>
          <TableHead>{dict.thisListColumn}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {visitTypes.map((visitType) => (
          <PriceListItemRow
            key={visitType.id}
            visitType={visitType}
            priceListId={priceListId}
            override={overrides[visitType.id]}
            dict={dict}
          />
        ))}
      </TableBody>
    </Table>
  );
}

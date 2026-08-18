"use client";

import { useState } from "react";
import { CalendarClock, FilePlus2, MapPin } from "lucide-react";

import {
  isBillableTreatmentPlanItemStatus,
  isCustomPlanItem,
  resolveInvoiceAppointmentId,
  treatmentPlanItemsToInvoiceItems,
} from "@/lib/treatment-plans/calculations";
import { formatCurrency } from "@/lib/billing/format";
import { InvoiceFormSheet } from "@/components/billing/invoice-form-sheet";
import type { SelectedPatient } from "@/components/appointments/patient-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TreatmentPlanItemStatusBadge } from "@/components/treatment-plans/treatment-plan-item-badges";
import type { TreatmentPlanItemWithContext } from "@/lib/treatment-plans/queries";
import type { TreatmentPlanItemStatus, VisitType } from "@/types/domain";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

/**
 * One selectable row in the batch picker — deliberately a compact card
 * (mirrors TreatmentPlanItemRow's information density, not a table row):
 * procedure + tooth + custom/catalog nature up top, qty/price/status/
 * appointment as a scannable badge cluster underneath. Selecting is just a
 * checkbox; there is no per-item action here.
 */
function BillableItemRow({
  item,
  selected,
  onToggle,
}: {
  item: TreatmentPlanItemWithContext;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 hover:bg-muted/50">
      <Checkbox checked={selected} onCheckedChange={onToggle} className="mt-0.5" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="font-medium">{item.procedure_name}</p>
          {item.tooth_id != null && (
            <Badge variant="secondary">
              <MapPin className="size-3" />
              Tooth {item.tooth_id}
            </Badge>
          )}
          {isCustomPlanItem(item) && <Badge variant="outline">Custom</Badge>}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <TreatmentPlanItemStatusBadge status={item.status as TreatmentPlanItemStatus} />
          <span className="text-muted-foreground">
            {formatCurrency(Number(item.estimated_price))}
            {Number(item.quantity) !== 1 && ` × ${Number(item.quantity)}`}
          </span>
          {item.appointmentScheduledStart && (
            <Badge variant="outline">
              <CalendarClock className="size-3" />
              {formatDateTime(item.appointmentScheduledStart)}
            </Badge>
          )}
        </div>
      </div>
    </label>
  );
}

/**
 * Plan-level "Create Invoice" entry point — a two-step, sequential (not
 * nested) flow: a compact selection Dialog over accepted/completed items,
 * then the existing InvoiceFormSheet pre-seeded from the reviewed
 * selection. Nothing is submitted here; InvoiceFormSheet's own explicit
 * Save is still the only thing that ever creates the invoice, and every
 * seeded field stays editable there exactly as it already is for the
 * appointment -> invoice flow. There is deliberately no persisted link
 * between the selected treatment_plan_items and the resulting invoice —
 * this is a one-time human-reviewed prefill, not a tracked relationship.
 */
export function TreatmentPlanCreateInvoiceButton({
  patientId,
  patientName,
  items,
  visitTypes,
}: {
  patientId: string;
  patientName: string;
  items: TreatmentPlanItemWithContext[];
  visitTypes: VisitType[];
}) {
  const [step, setStep] = useState<"closed" | "picking" | "reviewing">("closed");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const billableItems = items.filter((item) => isBillableTreatmentPlanItemStatus(item.status));
  if (billableItems.length === 0) return null;

  const selectedItems = billableItems.filter((item) => selectedIds.has(item.id));

  function openPicker() {
    setSelectedIds(new Set(billableItems.map((item) => item.id)));
    setStep("picking");
  }

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const initialPatient: SelectedPatient = { id: patientId, full_name: patientName };

  return (
    <>
      <Button variant="outline" onClick={openPicker}>
        <FilePlus2 className="size-4" />
        Create Invoice
      </Button>

      <Dialog open={step === "picking"} onOpenChange={(open) => !open && setStep("closed")}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create invoice from this plan</DialogTitle>
            <DialogDescription>
              Only accepted and completed procedures can be invoiced. Every line stays editable on the next screen
              before anything is saved.
            </DialogDescription>
          </DialogHeader>

          <p className="text-xs text-muted-foreground">
            Dentra doesn&apos;t track which procedures have already been invoiced — review the selection below to
            avoid billing the same item twice.
          </p>

          <div className="max-h-[50vh] space-y-2 overflow-y-auto">
            {billableItems.map((item) => (
              <BillableItemRow key={item.id} item={item} selected={selectedIds.has(item.id)} onToggle={() => toggle(item.id)} />
            ))}
          </div>

          <DialogFooter className="items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              {selectedIds.size} of {billableItems.length} selected
            </p>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setStep("closed")}>
                Cancel
              </Button>
              <Button type="button" disabled={selectedIds.size === 0} onClick={() => setStep("reviewing")}>
                Continue
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {step === "reviewing" && (
        <InvoiceFormSheet
          visitTypes={visitTypes}
          initialPatient={initialPatient}
          initialAppointmentId={resolveInvoiceAppointmentId(selectedItems) ?? undefined}
          initialItems={treatmentPlanItemsToInvoiceItems(selectedItems, visitTypes)}
          open={step === "reviewing"}
          onOpenChange={(open) => !open && setStep("closed")}
        />
      )}
    </>
  );
}

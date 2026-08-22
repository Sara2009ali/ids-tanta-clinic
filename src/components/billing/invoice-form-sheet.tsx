"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FilePlus2, Loader2, Plus, Trash2 } from "lucide-react";

import { createInvoice, updateInvoice } from "@/lib/billing/actions";
import { computeInvoiceTotals } from "@/lib/billing/calculations";
import { formatCurrency } from "@/lib/billing/format";
import { getPatientBillingContext, type PatientBillingContext } from "@/lib/pricing/actions";
import { resolveServicePrice } from "@/lib/pricing/resolve";
import { aggregateInvoiceInsurance, computeLineInsuranceSplit } from "@/lib/insurance/calculations";
import type { InvoiceItemInputValues } from "@/lib/billing/schema";
import type { InvoiceDetail } from "@/lib/billing/queries";
import type { VisitType } from "@/types/domain";

import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FieldError, FormField } from "@/components/ui/form-field";
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
import { PatientPicker, type SelectedPatient } from "@/components/appointments/patient-picker";

function emptyItem(): InvoiceItemInputValues {
  return { description: "", quantity: 1, unit_price: 0, discount_amount: 0, visit_type_id: null };
}

function itemsFromInvoice(invoice: InvoiceDetail): InvoiceItemInputValues[] {
  if (invoice.items.length === 0) return [emptyItem()];
  return invoice.items.map((item) => ({
    description: item.description,
    quantity: Number(item.quantity),
    unit_price: Number(item.unit_price),
    discount_amount: Number(item.discount_amount),
    visit_type_id: item.visit_type_id,
  }));
}

/** `initialItems` (a batch seed) wins over `initialItem` (a single seed) when both are passed; either falls back to one blank item so create-mode never renders with zero rows. */
function initialItemsFor(initialItem?: InvoiceItemInputValues, initialItems?: InvoiceItemInputValues[]): InvoiceItemInputValues[] {
  if (initialItems && initialItems.length > 0) return initialItems;
  return [initialItem ?? emptyItem()];
}

/** "No procedure — plain custom line" sentinel for the picker below (same pattern as visit-types-filters.tsx's ALL_VALUE). */
const CUSTOM_ITEM_VALUE = "__custom__";

interface ProcedureOption {
  id: string;
  name: string;
  color: string;
  category: string | null;
  price: number;
  isActive: boolean;
}

function toProcedureOption(visitType: VisitType): ProcedureOption {
  return {
    id: visitType.id,
    name: visitType.name,
    color: visitType.color,
    category: visitType.category,
    price: Number(visitType.price),
    isActive: visitType.is_active,
  };
}

function ProcedureOptionLabel({ option }: { option: ProcedureOption }) {
  return (
    <span className="flex items-center gap-1.5">
      <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ backgroundColor: option.color }} />
      {option.name}
      {!option.isActive && <span className="text-muted-foreground">(inactive)</span>}
    </span>
  );
}

/**
 * Picks a catalog procedure to prefill an invoice line, or leaves it as a
 * plain custom item — the "Add service -> choose procedure -> review
 * price" flow the Procedures Catalog exists to support. Only active
 * procedures are offered for a *new* selection (matches the same
 * `is_active` gate the appointment booking dropdown already enforces via
 * listVisitTypes()); an item already linked to a since-disabled procedure
 * keeps showing correctly via `inactiveFallback` below instead of silently
 * losing its selection, so a draft invoice someone reopens after an admin
 * disables a procedure doesn't look broken.
 */
function ProcedureField({
  visitTypes,
  item,
  onSelect,
}: {
  visitTypes: VisitType[];
  item: InvoiceItemInputValues;
  onSelect: (option: ProcedureOption | null) => void;
}) {
  const activeOptions = visitTypes.map(toProcedureOption);
  const selected = item.visit_type_id ? activeOptions.find((option) => option.id === item.visit_type_id) : undefined;
  const inactiveFallback: ProcedureOption | null =
    item.visit_type_id && !selected
      ? {
          id: item.visit_type_id,
          name: item.description || "Linked procedure",
          color: "#9ca3af",
          category: null,
          price: Number(item.unit_price) || 0,
          isActive: false,
        }
      : null;

  const categories = Array.from(new Set(activeOptions.map((option) => option.category ?? "Other"))).sort((a, b) =>
    a.localeCompare(b),
  );
  const grouped = categories.length > 1;

  function handleValueChange(value: string | null) {
    if (!value || value === CUSTOM_ITEM_VALUE) {
      onSelect(null);
      return;
    }
    const option = inactiveFallback?.id === value ? inactiveFallback : activeOptions.find((o) => o.id === value);
    if (option) onSelect(option);
  }

  return (
    <Select
      items={{
        [CUSTOM_ITEM_VALUE]: <span className="text-muted-foreground">Custom item</span>,
        ...(inactiveFallback ? { [inactiveFallback.id]: <ProcedureOptionLabel option={inactiveFallback} /> } : {}),
        ...Object.fromEntries(activeOptions.map((option) => [option.id, <ProcedureOptionLabel key={option.id} option={option} />])),
      }}
      value={item.visit_type_id ?? CUSTOM_ITEM_VALUE}
      onValueChange={handleValueChange}
    >
      <SelectTrigger className="h-8 w-full sm:w-56">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={CUSTOM_ITEM_VALUE}>
          <span className="text-muted-foreground">Custom item</span>
        </SelectItem>
        {inactiveFallback && (
          <SelectItem value={inactiveFallback.id}>
            <ProcedureOptionLabel option={inactiveFallback} />
          </SelectItem>
        )}
        {activeOptions.length > 0 && <SelectSeparator />}
        {grouped
          ? categories.map((category) => (
              <SelectGroup key={category}>
                <SelectLabel>{category}</SelectLabel>
                {activeOptions
                  .filter((option) => (option.category ?? "Other") === category)
                  .map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      <ProcedureOptionLabel option={option} />
                    </SelectItem>
                  ))}
              </SelectGroup>
            ))
          : activeOptions.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                <ProcedureOptionLabel option={option} />
              </SelectItem>
            ))}
      </SelectContent>
    </Select>
  );
}

/**
 * One invoice line: an optional procedure picker (hidden entirely when the
 * clinic hasn't set up a catalog yet, so a clinic with zero procedures sees
 * exactly today's plain custom-item row) plus the description/qty/price/
 * discount fields, which stay the single source of truth for what this
 * line actually charges — selecting a procedure only prefills them once,
 * it never locks them.
 */
function InvoiceItemRow({
  item,
  visitTypes,
  onChange,
  onRemove,
  canRemove,
}: {
  item: InvoiceItemInputValues;
  visitTypes: VisitType[];
  onChange: (patch: Partial<InvoiceItemInputValues>) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const catalogPrice = visitTypes.find((v) => v.id === item.visit_type_id)?.price;
  const priceOverridden =
    item.visit_type_id != null && catalogPrice != null && Number(item.unit_price) !== Number(catalogPrice);

  function handleProcedureSelect(option: ProcedureOption | null) {
    if (!option) {
      onChange({ visit_type_id: null });
      return;
    }
    // Switching procedures always resets description + price to the new
    // catalog defaults, rather than trying to preserve a manual edit that
    // applied to a different procedure at a different price — predictable
    // beats clever here, and there's no hidden "was this edited" flag to
    // keep in sync as a result.
    onChange({ visit_type_id: option.id, description: option.name, unit_price: option.price });
  }

  return (
    <div className="space-y-2 rounded-lg border border-border p-2">
      {visitTypes.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <ProcedureField visitTypes={visitTypes} item={item} onSelect={handleProcedureSelect} />
          {priceOverridden && (
            <button
              type="button"
              onClick={() => onChange({ unit_price: catalogPrice })}
              className="text-xs text-muted-foreground hover:text-foreground hover:underline"
            >
              Catalog price is {formatCurrency(Number(catalogPrice))} — reset
            </button>
          )}
        </div>
      )}
      <div className="grid grid-cols-12 gap-2">
        <div className="col-span-12 sm:col-span-5">
          <Input
            placeholder="Description"
            value={item.description}
            onChange={(event) => onChange({ description: event.target.value })}
          />
        </div>
        <div className="col-span-4 sm:col-span-2">
          <Input
            type="number"
            min={0.01}
            step={0.01}
            placeholder="Qty"
            value={item.quantity}
            onChange={(event) => onChange({ quantity: Number(event.target.value) })}
          />
        </div>
        <div className="col-span-4 sm:col-span-2">
          <Input
            type="number"
            min={0}
            step={0.01}
            placeholder="Unit price"
            value={item.unit_price}
            onChange={(event) => onChange({ unit_price: Number(event.target.value) })}
          />
        </div>
        <div className="col-span-3 sm:col-span-2">
          <Input
            type="number"
            min={0}
            step={0.01}
            placeholder="Discount"
            value={item.discount_amount}
            onChange={(event) => onChange({ discount_amount: Number(event.target.value) })}
          />
        </div>
        <div className="col-span-1 flex items-center justify-end">
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            disabled={!canRemove}
            onClick={onRemove}
            aria-label="Remove item"
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export interface InvoiceFormSheetProps {
  /** Editing an existing draft invoice. Omit for create mode. */
  invoice?: InvoiceDetail;
  /** Pre-fills + locks the patient, for "create invoice from appointment". Ignored in edit mode. */
  initialPatient?: SelectedPatient;
  /** Links the new invoice to an appointment. Ignored in edit mode. */
  initialAppointmentId?: string;
  /**
   * Seeds the first invoice line (e.g. from an appointment's visit type +
   * its current catalog price) instead of a blank item. Ignored in edit
   * mode. Still just a starting point — every field stays exactly as
   * editable as a manually-added item, same ProcedureField/description/
   * price/quantity/discount behavior, nothing new introduced here.
   */
  initialItem?: InvoiceItemInputValues;
  /**
   * Seeds multiple invoice lines at once (e.g. from a batch of accepted/
   * completed Treatment Plan items) instead of a single line. Ignored in
   * edit mode. Takes precedence over `initialItem` when both are passed —
   * callers are expected to use one or the other, never both — and falls
   * back to `initialItem`/a blank item when omitted or empty, so the
   * existing single-item appointment -> invoice flow is unaffected. Same
   * "still just a starting point, everything stays editable" contract as
   * `initialItem`.
   */
  initialItems?: InvoiceItemInputValues[];
  /** Active procedures for the item picker. Pass `[]` (never omit) if the caller can't fetch it — the picker just hides itself, same as a clinic with an empty catalog. */
  visitTypes: VisitType[];
  className?: string;
  /**
   * Uncontrolled by default (renders its own trigger button — the Billing
   * Dashboard/Invoice List "New Invoice" use case). Pass open/onOpenChange
   * to control it externally instead — e.g. from a dropdown menu item,
   * matching how PatientRowActions controls its delete AlertDialog.
   */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function InvoiceFormSheet({
  invoice,
  initialPatient,
  initialAppointmentId,
  initialItem,
  initialItems,
  visitTypes,
  className,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: InvoiceFormSheetProps) {
  const router = useRouter();
  const isEdit = !!invoice;
  const isControlled = controlledOpen !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? (controlledOnOpenChange ?? (() => {})) : setInternalOpen;

  const [pending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [patient, setPatient] = useState<SelectedPatient | null>(
    invoice ? { id: invoice.patient_id, full_name: invoice.patient_name } : (initialPatient ?? null),
  );
  const [items, setItems] = useState<InvoiceItemInputValues[]>(
    invoice ? itemsFromInvoice(invoice) : initialItemsFor(initialItem, initialItems),
  );
  const [taxPercent, setTaxPercent] = useState(invoice ? Number(invoice.tax_percent) : 0);
  const lockPatient = isEdit || !!initialPatient;

  // Resolves the selected patient's pricing AND insurance context (their
  // assigned Price List, or the clinic default; their active structured
  // insurance plan, if any) whenever the patient changes — the only place
  // in this form the patient is genuinely dynamic; everywhere else (Price
  // List item editor, Treatment Plan item dialog) fetches this server-side
  // once, since the patient there is fixed for the whole page. Gated on
  // `open`: an uncontrolled InvoiceFormSheet (its own "New Invoice" trigger)
  // is mounted the moment its parent page renders, well before anyone opens
  // it — without this gate, every page that renders one would fire this
  // request on load whether or not the sheet is ever used.
  const [priceContext, setPriceContext] = useState<PatientBillingContext | null>(null);
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    if (!patient?.id) {
      Promise.resolve().then(() => {
        if (!cancelled) setPriceContext(null);
      });
      return () => {
        cancelled = true;
      };
    }
    getPatientBillingContext(patient.id).then((context) => {
      if (!cancelled) setPriceContext(context);
    });
    return () => {
      cancelled = true;
    };
  }, [open, patient?.id]);

  // The one price resolution path (resolveServicePrice), applied once here
  // so every consumer below (ProcedureField's list, the catalog-price reset
  // button) just sees each procedure's already-resolved price for this
  // patient — never visit_types.price directly.
  const pricedVisitTypes = useMemo(() => {
    const overridesMap = new Map(Object.entries(priceContext?.overrides ?? {}));
    return visitTypes.map((visitType) => ({
      ...visitType,
      price: resolveServicePrice({
        visitTypeId: visitType.id,
        basePrice: Number(visitType.price),
        priceListId: priceContext?.priceListId ?? null,
        defaultPriceListId: priceContext?.defaultPriceListId ?? null,
        overrides: overridesMap,
      }),
    }));
  }, [visitTypes, priceContext]);

  const totals = useMemo(
    () =>
      computeInvoiceTotals(
        items.map((item) => ({
          quantity: Number(item.quantity) || 0,
          unitPrice: Number(item.unit_price) || 0,
          discountAmount: Number(item.discount_amount) || 0,
        })),
        Number(taxPercent) || 0,
      ),
    [items, taxPercent],
  );

  // Live preview only — the values actually saved are computed server-side
  // in invoiceItemRows() (src/lib/billing/actions.ts), from the same pure
  // computeLineInsuranceSplit(), so this can never disagree with what gets
  // stored (and never lets a tampered client value slip through, since the
  // server never trusts this computation, only re-derives its own).
  const insuranceTotals = useMemo(() => {
    const coveragePercent = priceContext?.insurance?.coveragePercent ?? null;
    const lines = items.map((item) => {
      const lineTotal = Math.max(
        0,
        (Number(item.quantity) || 0) * (Number(item.unit_price) || 0) - (Number(item.discount_amount) || 0),
      );
      const split = computeLineInsuranceSplit(lineTotal, coveragePercent);
      return {
        insurance_coverage_percent: split.insuranceCoveragePercent,
        insurance_covered_amount: split.insuranceCoveredAmount,
        patient_responsibility: split.patientResponsibility,
      };
    });
    return aggregateInvoiceInsurance(lines);
  }, [items, priceContext]);

  function resetForm() {
    setFieldErrors({});
    if (!isEdit) {
      setPatient(initialPatient ?? null);
      setItems(initialItemsFor(initialItem, initialItems));
      setTaxPercent(0);
    }
  }

  function updateItem(index: number, patch: Partial<InvoiceItemInputValues>) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function addItem() {
    setItems((prev) => [...prev, emptyItem()]);
  }

  function removeItem(index: number) {
    setItems((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  }

  function handleSubmit(formData: FormData) {
    formData.set("items", JSON.stringify(items));

    startTransition(async () => {
      const result = isEdit ? await updateInvoice(invoice.id, formData) : await createInvoice(formData);

      if (result.error) {
        toast.error(result.error);
        setFieldErrors(result.fieldErrors ?? {});
      } else {
        toast.success(isEdit ? "Invoice updated" : "Invoice created");
        setOpen(false);
        resetForm();
        if (!isEdit && result.invoiceId) {
          router.push(`/billing/invoices/${result.invoiceId}`);
        } else {
          router.refresh();
        }
      }
    });
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) resetForm();
      }}
    >
      {!isControlled && (
        <SheetTrigger render={<Button className={className} />}>
          <FilePlus2 className="size-4" />
          New Invoice
        </SheetTrigger>
      )}
      <SheetContent className="sm:max-w-xl" side="right">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Edit Invoice" : "New Invoice"}</SheetTitle>
          <SheetDescription>
            {isEdit
              ? "Draft invoices can be freely edited before they're issued."
              : "Add treatment items and issue when ready."}
          </SheetDescription>
        </SheetHeader>

        <form action={handleSubmit} className="flex flex-1 flex-col gap-4 overflow-y-auto px-5">
          <input type="hidden" name="appointment_id" value={initialAppointmentId ?? invoice?.appointment_id ?? ""} />
          <input type="hidden" name="patient_id" value={patient?.id ?? ""} />

          <div className="space-y-2">
            <Label>
              Patient
              <span aria-hidden="true" className="text-destructive">
                *
              </span>
            </Label>
            {lockPatient ? (
              <div className="rounded-lg border border-input bg-muted/50 px-2.5 py-1.5 text-sm">
                {patient?.full_name}
              </div>
            ) : (
              <PatientPicker value={patient} onChange={setPatient} error={fieldErrors.patient_id} />
            )}
            {priceContext?.priceListName && (
              <p className="text-xs text-muted-foreground">Pricing: {priceContext.priceListName}</p>
            )}
            {priceContext?.insurance && (
              <p className="text-xs text-muted-foreground">
                Insurance: {priceContext.insurance.insurerName} — {priceContext.insurance.planName}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>
                Items
                <span aria-hidden="true" className="text-destructive">
                  *
                </span>
              </Label>
              <Button type="button" size="sm" variant="outline" onClick={addItem}>
                <Plus className="size-3.5" />
                Add item
              </Button>
            </div>
            <div className="space-y-2">
              {items.map((item, index) => (
                <InvoiceItemRow
                  key={index}
                  item={item}
                  visitTypes={pricedVisitTypes}
                  onChange={(patch) => updateItem(index, patch)}
                  onRemove={() => removeItem(index)}
                  canRemove={items.length > 1}
                />
              ))}
            </div>
            <FieldError message={fieldErrors.items} />
          </div>

          <FormField label="Tax %" htmlFor="tax_percent" error={fieldErrors.tax_percent}>
            <Input
              id="tax_percent"
              name="tax_percent"
              type="number"
              min={0}
              max={100}
              step={0.01}
              value={taxPercent}
              onChange={(event) => setTaxPercent(Number(event.target.value))}
              aria-invalid={!!fieldErrors.tax_percent}
              className="w-32"
            />
          </FormField>

          <FormField label="Notes" htmlFor="notes">
            <Textarea id="notes" name="notes" defaultValue={invoice?.notes ?? ""} />
          </FormField>

          <div className="mt-auto space-y-1 rounded-xl bg-muted p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="tabular-nums">{formatCurrency(totals.subtotal)}</span>
            </div>
            {insuranceTotals.applied && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Insurance ({priceContext?.insurance?.coveragePercent ?? 0}%)</span>
                <span className="tabular-nums">−{formatCurrency(insuranceTotals.insuranceTotal)}</span>
              </div>
            )}
            {insuranceTotals.applied && (
              <div className="flex justify-between font-medium">
                <span>
                  Patient responsibility
                  {Number(taxPercent) > 0 && <span className="text-muted-foreground"> (before tax)</span>}
                </span>
                <span className="tabular-nums">{formatCurrency(insuranceTotals.patientResponsibilityTotal)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tax</span>
              <span className="tabular-nums">{formatCurrency(totals.taxAmount)}</span>
            </div>
            <div className="flex justify-between border-t border-border pt-1 font-semibold">
              <span>Total</span>
              <span className="tabular-nums">{formatCurrency(totals.total)}</span>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 pb-4">
            <SheetClose render={<Button type="button" variant="outline" disabled={pending} />}>
              Cancel
            </SheetClose>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              {isEdit ? "Save changes" : "Create invoice"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

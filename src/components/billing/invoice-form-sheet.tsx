"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FilePlus2, Loader2, Plus, Trash2 } from "lucide-react";

import { createInvoice, updateInvoice } from "@/lib/billing/actions";
import { computeInvoiceTotals } from "@/lib/billing/calculations";
import { formatCurrency } from "@/lib/billing/format";
import type { InvoiceItemInputValues } from "@/lib/billing/schema";
import type { InvoiceDetail } from "@/lib/billing/queries";

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
import { PatientPicker, type SelectedPatient } from "@/components/appointments/patient-picker";

function emptyItem(): InvoiceItemInputValues {
  return { description: "", quantity: 1, unit_price: 0, discount_amount: 0 };
}

function itemsFromInvoice(invoice: InvoiceDetail): InvoiceItemInputValues[] {
  if (invoice.items.length === 0) return [emptyItem()];
  return invoice.items.map((item) => ({
    description: item.description,
    quantity: Number(item.quantity),
    unit_price: Number(item.unit_price),
    discount_amount: Number(item.discount_amount),
  }));
}

export interface InvoiceFormSheetProps {
  /** Editing an existing draft invoice. Omit for create mode. */
  invoice?: InvoiceDetail;
  /** Pre-fills + locks the patient, for "create invoice from appointment". Ignored in edit mode. */
  initialPatient?: SelectedPatient;
  /** Links the new invoice to an appointment. Ignored in edit mode. */
  initialAppointmentId?: string;
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
    invoice ? itemsFromInvoice(invoice) : [emptyItem()],
  );
  const [taxPercent, setTaxPercent] = useState(invoice ? Number(invoice.tax_percent) : 0);
  const lockPatient = isEdit || !!initialPatient;

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

  function resetForm() {
    setFieldErrors({});
    if (!isEdit) {
      setPatient(initialPatient ?? null);
      setItems([emptyItem()]);
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

        <form action={handleSubmit} className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
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
                <div key={index} className="grid grid-cols-12 gap-2 rounded-lg border border-border p-2">
                  <div className="col-span-12 sm:col-span-5">
                    <Input
                      placeholder="Description"
                      value={item.description}
                      onChange={(event) => updateItem(index, { description: event.target.value })}
                    />
                  </div>
                  <div className="col-span-4 sm:col-span-2">
                    <Input
                      type="number"
                      min={0.01}
                      step={0.01}
                      placeholder="Qty"
                      value={item.quantity}
                      onChange={(event) => updateItem(index, { quantity: Number(event.target.value) })}
                    />
                  </div>
                  <div className="col-span-4 sm:col-span-2">
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      placeholder="Unit price"
                      value={item.unit_price}
                      onChange={(event) => updateItem(index, { unit_price: Number(event.target.value) })}
                    />
                  </div>
                  <div className="col-span-3 sm:col-span-2">
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      placeholder="Discount"
                      value={item.discount_amount}
                      onChange={(event) => updateItem(index, { discount_amount: Number(event.target.value) })}
                    />
                  </div>
                  <div className="col-span-1 flex items-center justify-end">
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      disabled={items.length === 1}
                      onClick={() => removeItem(index)}
                      aria-label="Remove item"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
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
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tax</span>
              <span className="tabular-nums">{formatCurrency(totals.taxAmount)}</span>
            </div>
            <div className="flex justify-between font-semibold">
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

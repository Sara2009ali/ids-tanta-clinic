"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FieldError, FormField } from "@/components/ui/form-field";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createTreatmentPlanItem, updateTreatmentPlanItem } from "@/lib/treatment-plans/actions";
import { ToothSelect } from "@/components/dental-chart/tooth-select";
import { TREATMENT_PLAN_ITEM_PRIORITY_LABELS, type TreatmentPlanItemPriority, type VisitType } from "@/types/domain";
import type { TreatmentPlanItemWithContext } from "@/lib/treatment-plans/queries";
import type { ScheduleRow } from "@/lib/appointments/queries";

const CUSTOM_ITEM_VALUE = "__custom__";
const NO_APPOINTMENT = "__none__";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

/**
 * Treatment-Plan-specific procedure picker — visually the same "pick a
 * catalog procedure, prefill once, keep editable" shape as billing's
 * ProcedureField, but a separate implementation (per the approved design:
 * reuse the pattern, not the billing code) since this picks a
 * procedure_name/estimated_price snapshot for a plan item, not an invoice
 * line.
 */
function ProcedurePicker({
  visitTypes,
  visitTypeId,
  onSelect,
}: {
  visitTypes: VisitType[];
  visitTypeId: string | null;
  onSelect: (visitType: VisitType | null) => void;
}) {
  const categories = Array.from(new Set(visitTypes.map((v) => v.category ?? "Other"))).sort((a, b) => a.localeCompare(b));
  const grouped = categories.length > 1;

  function handleValueChange(value: string | null) {
    if (!value || value === CUSTOM_ITEM_VALUE) {
      onSelect(null);
      return;
    }
    const visitType = visitTypes.find((v) => v.id === value);
    if (visitType) onSelect(visitType);
  }

  return (
    <Select
      items={{
        [CUSTOM_ITEM_VALUE]: "Custom procedure",
        ...Object.fromEntries(visitTypes.map((v) => [v.id, v.name])),
      }}
      value={visitTypeId ?? CUSTOM_ITEM_VALUE}
      onValueChange={handleValueChange}
    >
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={CUSTOM_ITEM_VALUE}>Custom procedure</SelectItem>
        {visitTypes.length > 0 && <SelectSeparator />}
        {grouped
          ? categories.map((category) => (
              <SelectGroup key={category}>
                <SelectLabel>{category}</SelectLabel>
                {visitTypes
                  .filter((v) => (v.category ?? "Other") === category)
                  .map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name}
                    </SelectItem>
                  ))}
              </SelectGroup>
            ))
          : visitTypes.map((v) => (
              <SelectItem key={v.id} value={v.id}>
                {v.name}
              </SelectItem>
            ))}
      </SelectContent>
    </Select>
  );
}

interface FormState {
  procedureName: string;
  estimatedPrice: string;
  quantity: string;
  toothReference: string;
  toothId: number | null;
  priority: TreatmentPlanItemPriority;
  notes: string;
  visitTypeId: string | null;
  appointmentId: string;
}

function emptyForm(): FormState {
  return {
    procedureName: "",
    estimatedPrice: "",
    quantity: "1",
    toothReference: "",
    toothId: null,
    priority: "normal",
    notes: "",
    visitTypeId: null,
    appointmentId: NO_APPOINTMENT,
  };
}

function formFromItem(item: TreatmentPlanItemWithContext): FormState {
  return {
    procedureName: item.procedure_name,
    estimatedPrice: String(item.estimated_price),
    quantity: String(item.quantity),
    toothReference: item.tooth_reference ?? "",
    toothId: item.tooth_id ?? null,
    priority: item.priority as TreatmentPlanItemPriority,
    notes: item.notes ?? "",
    visitTypeId: item.visit_type_id,
    appointmentId: item.appointment_id ?? NO_APPOINTMENT,
  };
}

export function TreatmentPlanItemDialog({
  planId,
  visitTypes,
  appointments,
  item,
  open,
  onOpenChange,
}: {
  planId: string;
  visitTypes: VisitType[];
  appointments: ScheduleRow[];
  /** Editing an existing item. Omit for add mode. */
  item?: TreatmentPlanItemWithContext;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const isEdit = !!item;
  const [pending, startTransition] = useTransition();
  // Lazy initializers only — the caller mounts this component fresh each
  // time it opens (see TreatmentPlanItemsList, which renders both the add
  // and edit dialogs conditionally on their own open state), so a plain
  // useState seed is enough; no effect is needed to "re-seed on open".
  const [form, setForm] = useState<FormState>(() => (item ? formFromItem(item) : emptyForm()));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function handleProcedureSelect(visitType: VisitType | null) {
    if (!visitType) {
      setForm((prev) => ({ ...prev, visitTypeId: null }));
      return;
    }
    setForm((prev) => ({ ...prev, visitTypeId: visitType.id, procedureName: visitType.name, estimatedPrice: String(visitType.price) }));
  }

  function handleSubmit() {
    const formData = new FormData();
    formData.set("procedure_name", form.procedureName);
    formData.set("estimated_price", form.estimatedPrice);
    formData.set("quantity", form.quantity);
    formData.set("tooth_reference", form.toothReference);
    formData.set("tooth_id", form.toothId != null ? String(form.toothId) : "");
    formData.set("priority", form.priority);
    formData.set("notes", form.notes);
    formData.set("visit_type_id", form.visitTypeId ?? "");
    formData.set("appointment_id", form.appointmentId === NO_APPOINTMENT ? "" : form.appointmentId);

    startTransition(async () => {
      const result = isEdit
        ? await updateTreatmentPlanItem(item.id, formData)
        : await createTreatmentPlanItem(planId, formData);

      if (result.error) {
        toast.error(result.error);
        setFieldErrors(result.fieldErrors ?? {});
      } else {
        toast.success(isEdit ? "Procedure updated" : "Procedure added");
        onOpenChange(false);
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit procedure" : "Add procedure"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Update this proposed procedure." : "Propose a procedure as part of this treatment plan."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <FormField label="Procedure" htmlFor="item_procedure_picker" required>
            <ProcedurePicker visitTypes={visitTypes} visitTypeId={form.visitTypeId} onSelect={handleProcedureSelect} />
          </FormField>

          <FormField label="Procedure name" htmlFor="item_procedure_name" required error={fieldErrors.procedure_name}>
            <Input
              id="item_procedure_name"
              value={form.procedureName}
              onChange={(e) => setForm((prev) => ({ ...prev, procedureName: e.target.value }))}
              aria-invalid={!!fieldErrors.procedure_name}
            />
          </FormField>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField label="Estimated price" htmlFor="item_price" required error={fieldErrors.estimated_price}>
              <Input
                id="item_price"
                type="number"
                min={0}
                step={0.01}
                value={form.estimatedPrice}
                onChange={(e) => setForm((prev) => ({ ...prev, estimatedPrice: e.target.value }))}
                aria-invalid={!!fieldErrors.estimated_price}
              />
            </FormField>
            <FormField label="Quantity" htmlFor="item_quantity" required error={fieldErrors.quantity}>
              <Input
                id="item_quantity"
                type="number"
                min={0.01}
                step={0.01}
                value={form.quantity}
                onChange={(e) => setForm((prev) => ({ ...prev, quantity: e.target.value }))}
                aria-invalid={!!fieldErrors.quantity}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField
              label="Tooth (structured)"
              htmlFor="item_tooth_id"
              description="Optional — powers the Dental Chart. Independent of the free-text field below; picking a tooth here never rewrites it."
            >
              <ToothSelect id="item_tooth_id" value={form.toothId} onValueChange={(fdi) => setForm((prev) => ({ ...prev, toothId: fdi }))} />
            </FormField>
            <FormField
              label="Tooth / site"
              htmlFor="item_tooth"
              description="Optional — write it the way you'd say it, e.g. “Tooth 36”, “Teeth 11, 21”, “Upper right quadrant”"
            >
              <Input
                id="item_tooth"
                placeholder="Tooth 36"
                value={form.toothReference}
                onChange={(e) => setForm((prev) => ({ ...prev, toothReference: e.target.value }))}
              />
            </FormField>
          </div>

          <FormField label="Priority" htmlFor="item_priority">
            <Select
              items={TREATMENT_PLAN_ITEM_PRIORITY_LABELS}
              value={form.priority}
              onValueChange={(v) => v && setForm((prev) => ({ ...prev, priority: v as TreatmentPlanItemPriority }))}
            >
              <SelectTrigger id="item_priority" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(TREATMENT_PLAN_ITEM_PRIORITY_LABELS) as [TreatmentPlanItemPriority, string][]).map(
                  ([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </FormField>

          {appointments.length > 0 && (
            <FormField
              label="Linked appointment"
              htmlFor="item_appointment"
              description="Optional — marks this procedure as scheduled for a specific visit"
            >
              <Select
                items={{
                  [NO_APPOINTMENT]: "No linked appointment",
                  ...Object.fromEntries(appointments.map((a) => [a.id, `${formatDateTime(a.scheduled_start)} — ${a.visit_type_name}`])),
                }}
                value={form.appointmentId}
                onValueChange={(v) => v && setForm((prev) => ({ ...prev, appointmentId: v }))}
              >
                <SelectTrigger id="item_appointment" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_APPOINTMENT}>No linked appointment</SelectItem>
                  {appointments.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {formatDateTime(a.scheduled_start)} — {a.visit_type_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError message={fieldErrors.appointment_id} />
            </FormField>
          )}

          <FormField label="Notes" htmlFor="item_notes" description="Why this procedure — clinical rationale">
            <Textarea
              id="item_notes"
              rows={3}
              value={form.notes}
              onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
            />
          </FormField>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={pending || !form.procedureName.trim()} onClick={handleSubmit}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            {isEdit ? "Save changes" : "Add procedure"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

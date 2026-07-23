"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";

import { setCompensationRule } from "@/lib/compensation/actions";
import { computeFullCompensation, type CompensationRuleConfig } from "@/lib/compensation/calculations";
import { COMPENSATION_RULE_TYPE_LABELS, type CompensationRule, type CompensationRuleType } from "@/types/domain";
import { formatCurrency } from "@/lib/billing/format";
import type { DoctorOption } from "@/lib/patients/queries";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ALL_DOCTORS = "all";
const ALL_PROCEDURES = "all";
/** Round reference figure for the live example — not a real invoice, just something to scale against mentally. */
const EXAMPLE_SUBTOTAL = 1000;

function ruleTypeLabel(type: CompensationRuleType) {
  return COMPENSATION_RULE_TYPE_LABELS[type];
}

function describeConfig(type: CompensationRuleType, config: CompensationRuleConfig): string {
  if (type === "percentage") return `${(config as { rate: number }).rate}%`;
  if (type === "fixed") return formatCurrency((config as { amount: number }).amount);
  const hybrid = config as { base_amount?: number; rate?: number };
  return `${formatCurrency(hybrid.base_amount ?? 0)} + ${hybrid.rate ?? 0}%`;
}

export interface SetCompensationRuleSheetProps {
  doctors: DoctorOption[];
  visitTypes: VisitType[];
  /** Replacing a specific active rule — doctor/procedure are locked to that rule's key, and its current rate is shown for comparison. Omit for a fresh "Set Rule" with an open doctor/procedure choice. */
  existingRule?: CompensationRule;
  className?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function SetCompensationRuleSheet({
  doctors,
  visitTypes,
  existingRule,
  className,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: SetCompensationRuleSheetProps) {
  const router = useRouter();
  const isReplacing = !!existingRule;
  const isControlled = controlledOpen !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? (controlledOnOpenChange ?? (() => {})) : setInternalOpen;

  const [pending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [doctorId, setDoctorId] = useState(existingRule?.doctor_id ?? "");
  const [visitTypeId, setVisitTypeId] = useState(existingRule?.visit_type_id ?? "");
  const [type, setType] = useState<CompensationRuleType>((existingRule?.type as CompensationRuleType) ?? "percentage");
  const [rate, setRate] = useState("");
  const [amount, setAmount] = useState("");
  const [baseAmount, setBaseAmount] = useState("");

  const example = useMemo(() => {
    const config: CompensationRuleConfig =
      type === "percentage"
        ? { rate: Number(rate) || 0 }
        : type === "fixed"
          ? { amount: Number(amount) || 0 }
          : { base_amount: Number(baseAmount) || 0, rate: Number(rate) || 0 };
    return computeFullCompensation(type, config, EXAMPLE_SUBTOTAL);
  }, [type, rate, amount, baseAmount]);

  function resetForm() {
    setFieldErrors({});
    if (!isReplacing) {
      setDoctorId("");
      setVisitTypeId("");
      setType("percentage");
    }
    setRate("");
    setAmount("");
    setBaseAmount("");
  }

  function handleSubmit(formData: FormData) {
    formData.set("doctor_id", doctorId);
    formData.set("visit_type_id", visitTypeId);
    formData.set("type", type);

    startTransition(async () => {
      const result = await setCompensationRule(formData);
      if (result.error) {
        toast.error(result.error);
        setFieldErrors(result.fieldErrors ?? {});
      } else {
        toast.success(isReplacing ? "Rate updated" : "Rate set");
        setOpen(false);
        resetForm();
        router.refresh();
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
          <Plus className="size-4" />
          Set Rule
        </SheetTrigger>
      )}
      <SheetContent className="sm:max-w-md" side="right">
        <SheetHeader>
          <SheetTitle>{isReplacing ? "Replace Rate" : "Set Rate"}</SheetTitle>
          <SheetDescription>
            {isReplacing
              ? "Saving replaces the current rate as of the effective date below. The old rate is preserved in History."
              : "Applies to future payments only — nothing already earned is recalculated."}
          </SheetDescription>
        </SheetHeader>

        <form action={handleSubmit} className="flex flex-1 flex-col gap-4 overflow-y-auto px-5">
          <div className="space-y-2">
            <Label>Doctor</Label>
            {isReplacing ? (
              <div className="rounded-lg border border-input bg-muted/50 px-2.5 py-1.5 text-sm">
                {existingRule?.doctor_id
                  ? `Dr. ${doctors.find((d) => d.id === existingRule.doctor_id)?.full_name ?? "—"}`
                  : "All doctors (clinic-wide)"}
              </div>
            ) : (
              <Select
                items={{
                  [ALL_DOCTORS]: "All doctors (clinic-wide)",
                  ...Object.fromEntries(doctors.map((d) => [d.id, `Dr. ${d.full_name}`])),
                }}
                value={doctorId || ALL_DOCTORS}
                onValueChange={(v) => setDoctorId(!v || v === ALL_DOCTORS ? "" : v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_DOCTORS}>All doctors (clinic-wide)</SelectItem>
                  {doctors.map((doctor) => (
                    <SelectItem key={doctor.id} value={doctor.id}>
                      Dr. {doctor.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-2">
            <Label>Procedure</Label>
            {isReplacing ? (
              <div className="rounded-lg border border-input bg-muted/50 px-2.5 py-1.5 text-sm">
                {existingRule?.visit_type_id
                  ? (visitTypes.find((v) => v.id === existingRule.visit_type_id)?.name ?? "—")
                  : "All procedures"}
              </div>
            ) : (
              <Select
                items={{
                  [ALL_PROCEDURES]: "All procedures",
                  ...Object.fromEntries(visitTypes.map((vt) => [vt.id, vt.name])),
                }}
                value={visitTypeId || ALL_PROCEDURES}
                onValueChange={(v) => setVisitTypeId(!v || v === ALL_PROCEDURES ? "" : v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_PROCEDURES}>All procedures</SelectItem>
                  {visitTypes.map((visitType) => (
                    <SelectItem key={visitType.id} value={visitType.id}>
                      {visitType.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {isReplacing && existingRule && (
            <p className="text-sm text-muted-foreground">
              Currently: {ruleTypeLabel(existingRule.type as CompensationRuleType)} —{" "}
              {describeConfig(existingRule.type as CompensationRuleType, existingRule.config as CompensationRuleConfig)}
            </p>
          )}

          <div className="space-y-2">
            <Label>Type *</Label>
            <Select
              items={COMPENSATION_RULE_TYPE_LABELS}
              value={type}
              onValueChange={(v) => v && setType(v as CompensationRuleType)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="percentage">{COMPENSATION_RULE_TYPE_LABELS.percentage}</SelectItem>
                <SelectItem value="fixed">{COMPENSATION_RULE_TYPE_LABELS.fixed}</SelectItem>
                <SelectItem value="hybrid">{COMPENSATION_RULE_TYPE_LABELS.hybrid}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(type === "percentage" || type === "hybrid") && (
            <div className="space-y-2">
              <Label htmlFor="rate">Rate (%) *</Label>
              <Input
                id="rate"
                name="rate"
                type="number"
                min={0}
                max={100}
                step={0.01}
                value={rate}
                onChange={(event) => setRate(event.target.value)}
              />
              {fieldErrors.rate && (
                <p className="text-sm text-destructive" role="alert">
                  {fieldErrors.rate}
                </p>
              )}
            </div>
          )}

          {type === "fixed" && (
            <div className="space-y-2">
              <Label htmlFor="amount">Fixed amount *</Label>
              <Input
                id="amount"
                name="amount"
                type="number"
                min={0}
                step={0.01}
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
              {fieldErrors.amount && (
                <p className="text-sm text-destructive" role="alert">
                  {fieldErrors.amount}
                </p>
              )}
            </div>
          )}

          {type === "hybrid" && (
            <div className="space-y-2">
              <Label htmlFor="base_amount">Base amount</Label>
              <Input
                id="base_amount"
                name="base_amount"
                type="number"
                min={0}
                step={0.01}
                value={baseAmount}
                onChange={(event) => setBaseAmount(event.target.value)}
              />
              {fieldErrors.base_amount && (
                <p className="text-sm text-destructive" role="alert">
                  {fieldErrors.base_amount}
                </p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="effective_from">Effective from</Label>
            <Input id="effective_from" name="effective_from" type="date" />
          </div>

          <div className="rounded-xl bg-muted p-3 text-sm">
            On a {formatCurrency(EXAMPLE_SUBTOTAL)} invoice, this doctor would earn{" "}
            <span className="font-semibold tabular-nums">{formatCurrency(example)}</span>.
          </div>

          <div className="mt-auto flex justify-end gap-2 pt-2 pb-4">
            <SheetClose render={<Button type="button" variant="outline" disabled={pending} />}>Cancel</SheetClose>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              {isReplacing ? "Save changes" : "Set rate"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

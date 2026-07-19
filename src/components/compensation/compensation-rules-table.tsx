"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Pencil, X } from "lucide-react";

import { closeCompensationRule } from "@/lib/compensation/actions";
import { SetCompensationRuleSheet } from "@/components/compensation/set-compensation-rule-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatCurrency } from "@/lib/billing/format";
import { COMPENSATION_RULE_TYPE_LABELS, type CompensationRule, type CompensationRuleType } from "@/types/domain";
import type { CompensationRuleConfig } from "@/lib/compensation/calculations";
import type { DoctorOption } from "@/lib/patients/queries";
import type { VisitType } from "@/types/domain";

function describeConfig(type: CompensationRuleType, config: CompensationRuleConfig): string {
  if (type === "percentage") return `${(config as { rate: number }).rate}%`;
  if (type === "fixed") return formatCurrency((config as { amount: number }).amount);
  const hybrid = config as { base_amount?: number; rate?: number };
  return `${formatCurrency(hybrid.base_amount ?? 0)} + ${hybrid.rate ?? 0}%`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString();
}

export function CompensationRulesTable({
  rules,
  doctors,
  visitTypes,
  canManage,
  mode,
}: {
  rules: CompensationRule[];
  doctors: DoctorOption[];
  visitTypes: VisitType[];
  canManage: boolean;
  mode: "active" | "history";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [replacingRule, setReplacingRule] = useState<CompensationRule | null>(null);
  const [closingRule, setClosingRule] = useState<CompensationRule | null>(null);

  function handleClose() {
    if (!closingRule) return;
    startTransition(async () => {
      const formData = new FormData();
      const result = await closeCompensationRule(closingRule.id, formData);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Rate closed");
        setClosingRule(null);
        router.refresh();
      }
    });
  }

  if (rules.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
        {mode === "active" ? "No active compensation rules yet." : "No rate changes yet."}
      </div>
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Doctor</TableHead>
              <TableHead>Procedure</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Rate</TableHead>
              <TableHead>Effective</TableHead>
              {mode === "history" && <TableHead>Status</TableHead>}
              {mode === "active" && canManage && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rules.map((rule) => {
              const doctorName = rule.doctor_id
                ? `Dr. ${doctors.find((d) => d.id === rule.doctor_id)?.full_name ?? "—"}`
                : "All doctors";
              const procedureName = rule.visit_type_id
                ? (visitTypes.find((v) => v.id === rule.visit_type_id)?.name ?? "—")
                : "All procedures";
              const type = rule.type as CompensationRuleType;

              return (
                <TableRow key={rule.id}>
                  <TableCell>{doctorName}</TableCell>
                  <TableCell>{procedureName}</TableCell>
                  <TableCell>{COMPENSATION_RULE_TYPE_LABELS[type]}</TableCell>
                  <TableCell className="tabular-nums">
                    {describeConfig(type, rule.config as CompensationRuleConfig)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(rule.effective_from)}
                    {rule.effective_to ? ` – ${formatDate(rule.effective_to)}` : ""}
                  </TableCell>
                  {mode === "history" && (
                    <TableCell>
                      {rule.effective_to ? (
                        <Badge variant="outline">Closed</Badge>
                      ) : (
                        <Badge variant="secondary">Active</Badge>
                      )}
                    </TableCell>
                  )}
                  {mode === "active" && canManage && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setReplacingRule(rule)}>
                          <Pencil className="size-3.5" />
                          Replace
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setClosingRule(rule)}>
                          <X className="size-3.5" />
                          Close
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {replacingRule && (
        <SetCompensationRuleSheet
          doctors={doctors}
          visitTypes={visitTypes}
          existingRule={replacingRule}
          open={!!replacingRule}
          onOpenChange={(open) => !open && setReplacingRule(null)}
        />
      )}

      <AlertDialog open={!!closingRule} onOpenChange={(open) => !open && setClosingRule(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Close this rate?</AlertDialogTitle>
            <AlertDialogDescription>
              {closingRule?.doctor_id
                ? `Dr. ${doctors.find((d) => d.id === closingRule.doctor_id)?.full_name ?? "—"}`
                : "All doctors"}{" "}
              will no longer be compensated for{" "}
              {closingRule?.visit_type_id
                ? (visitTypes.find((v) => v.id === closingRule.visit_type_id)?.name ?? "this procedure")
                : "any procedure"}{" "}
              under this rule going forward. This doesn&apos;t affect anything already earned.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={pending} onClick={handleClose}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              Close rate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

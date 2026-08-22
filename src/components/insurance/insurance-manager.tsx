"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, Power, PowerOff, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
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
import {
  createInsurancePlan,
  createInsurer,
  deleteInsurancePlan,
  deleteInsurer,
  toggleInsurancePlanActive,
  toggleInsurerActive,
} from "@/lib/insurance/actions";
import type { InsurancePlanWithInsurer, InsurerWithPlans } from "@/lib/insurance/queries";
import type { Dictionary } from "@/lib/i18n/types";

type DeleteTarget = { kind: "insurer"; id: string } | { kind: "plan"; id: string };

function PlanRow({
  plan,
  dict,
  onDeleteRequest,
}: {
  plan: InsurancePlanWithInsurer;
  dict: Dictionary["insurance"];
  onDeleteRequest: (target: DeleteTarget) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleToggle() {
    startTransition(async () => {
      const result = await toggleInsurancePlanActive(plan.id, !plan.is_active);
      if (result.error) toast.error(result.error);
      else router.refresh();
    });
  }

  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-2">
          <span>{plan.name}</span>
          {!plan.is_active && <Badge variant="outline">{dict.disable}</Badge>}
        </div>
      </TableCell>
      <TableCell className="text-muted-foreground tabular-nums">{Number(plan.coverage_percent)}%</TableCell>
      <TableCell>
        <div className="flex items-center justify-end gap-1">
          <Button
            size="icon-sm"
            variant="ghost"
            disabled={pending}
            onClick={handleToggle}
            aria-label={plan.is_active ? dict.disable : dict.enable}
          >
            {plan.is_active ? <PowerOff className="size-3.5" /> : <Power className="size-3.5" />}
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            disabled={pending}
            onClick={() => onDeleteRequest({ kind: "plan", id: plan.id })}
            aria-label={dict.delete}
            className="hover:text-destructive"
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function InsurerCard({
  insurer,
  dict,
  onDeleteRequest,
}: {
  insurer: InsurerWithPlans;
  dict: Dictionary["insurance"];
  onDeleteRequest: (target: DeleteTarget) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [newPlanName, setNewPlanName] = useState("");
  const [newPlanCoverage, setNewPlanCoverage] = useState("100");
  const [error, setError] = useState<string | undefined>();

  function handleToggleInsurer() {
    startTransition(async () => {
      const result = await toggleInsurerActive(insurer.id, !insurer.is_active);
      if (result.error) toast.error(result.error);
      else router.refresh();
    });
  }

  function handleAddPlan(formData: FormData) {
    startTransition(async () => {
      const result = await createInsurancePlan(insurer.id, formData);
      if (result.error) {
        setError(result.fieldErrors?.name ?? result.error);
        toast.error(result.error);
      } else {
        setNewPlanName("");
        setNewPlanCoverage("100");
        setError(undefined);
        router.refresh();
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            {insurer.name}
            {!insurer.is_active && <Badge variant="outline">{dict.disable}</Badge>}
          </span>
          <div className="flex items-center gap-1">
            <Button
              size="icon-sm"
              variant="ghost"
              disabled={pending}
              onClick={handleToggleInsurer}
              aria-label={insurer.is_active ? dict.disable : dict.enable}
            >
              {insurer.is_active ? <PowerOff className="size-3.5" /> : <Power className="size-3.5" />}
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              disabled={pending}
              onClick={() => onDeleteRequest({ kind: "insurer", id: insurer.id })}
              aria-label={dict.delete}
              className="hover:text-destructive"
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs font-medium text-muted-foreground">{dict.plansHeading}</p>

        {insurer.plans.length === 0 ? (
          <p className="text-sm text-muted-foreground">{dict.noPlans}</p>
        ) : (
          <Table>
            <TableBody>
              {insurer.plans.map((plan) => (
                <PlanRow key={plan.id} plan={plan} dict={dict} onDeleteRequest={onDeleteRequest} />
              ))}
            </TableBody>
          </Table>
        )}

        <form action={handleAddPlan} className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor={`new_plan_name_${insurer.id}`} className="text-xs">
              {dict.addPlan}
            </Label>
            <Input
              id={`new_plan_name_${insurer.id}`}
              name="name"
              value={newPlanName}
              onChange={(event) => setNewPlanName(event.target.value)}
              placeholder={dict.newPlanNamePlaceholder}
              disabled={pending}
              aria-invalid={!!error}
              className="h-8 w-48"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`new_plan_coverage_${insurer.id}`} className="text-xs">
              {dict.coverageLabel}
            </Label>
            <Input
              id={`new_plan_coverage_${insurer.id}`}
              name="coverage_percent"
              type="number"
              min={0}
              max={100}
              step={1}
              value={newPlanCoverage}
              onChange={(event) => setNewPlanCoverage(event.target.value)}
              disabled={pending}
              className="h-8 w-24"
            />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button type="submit" size="sm" variant="outline" disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            {dict.addPlan}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function InsuranceManager({ insurers, dict }: { insurers: InsurerWithPlans[]; dict: Dictionary["insurance"] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [newInsurerName, setNewInsurerName] = useState("");
  const [createError, setCreateError] = useState<string | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

  function handleCreateInsurer(formData: FormData) {
    startTransition(async () => {
      const result = await createInsurer(formData);
      if (result.error) {
        setCreateError(result.fieldErrors?.name ?? result.error);
        toast.error(result.error);
      } else {
        setNewInsurerName("");
        setCreateError(undefined);
        router.refresh();
      }
    });
  }

  function handleDelete() {
    if (!deleteTarget) return;
    startTransition(async () => {
      const result =
        deleteTarget.kind === "insurer" ? await deleteInsurer(deleteTarget.id) : await deleteInsurancePlan(deleteTarget.id);
      if (result.error) {
        toast.error(result.error);
      } else {
        setDeleteTarget(null);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{dict.insurersHeading}</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={handleCreateInsurer} className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label htmlFor="new_insurer_name" className="text-xs">
                {dict.addInsurer}
              </Label>
              <Input
                id="new_insurer_name"
                name="name"
                value={newInsurerName}
                onChange={(event) => setNewInsurerName(event.target.value)}
                placeholder={dict.newInsurerPlaceholder}
                disabled={pending}
                aria-invalid={!!createError}
                className="h-8 w-64"
              />
            </div>
            {createError && <p className="text-xs text-destructive">{createError}</p>}
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              {dict.addInsurer}
            </Button>
          </form>
        </CardContent>
      </Card>

      {insurers.length === 0 ? (
        <p className="text-sm text-muted-foreground">{dict.noInsurers}</p>
      ) : (
        <div className="space-y-4">
          {insurers.map((insurer) => (
            <InsurerCard key={insurer.id} insurer={insurer} dict={dict} onDeleteRequest={setDeleteTarget} />
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteTarget?.kind === "insurer" ? dict.deleteInsurerConfirmTitle : dict.deletePlanConfirmTitle}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.kind === "insurer" ? dict.deleteInsurerConfirmDescription : dict.deletePlanConfirmDescription}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>{dict.cancel}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={pending} onClick={handleDelete}>
              {dict.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

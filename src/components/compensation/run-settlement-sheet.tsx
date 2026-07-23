"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { HandCoins, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { previewDoctorSettlement, runDoctorSettlement, type SettlementPreview } from "@/lib/compensation/actions";
import { formatCurrency } from "@/lib/billing/format";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Two-step by design, mirroring the two Server Actions it wraps:
 * previewDoctorSettlement() (read-only) must be confirmed before
 * runDoctorSettlement() (irreversible — see its own doc comment, "there is
 * no rollback action") is reachable. period_start/period_end are pure
 * record-keeping on the resulting doctor_settlements row — run_doctor_
 * settlement() (0015) doesn't filter earnings by them, it sums every
 * currently-pending row regardless of date — so changing the dates never
 * invalidates an already-fetched preview.
 */
export function RunSettlementSheet({ doctorId, doctorName }: { doctorId: string; doctorName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [previewPending, startPreviewTransition] = useTransition();
  const [runPending, startRunTransition] = useTransition();
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState(today());
  const [preview, setPreview] = useState<SettlementPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const pending = previewPending || runPending;
  const periodValid = Boolean(periodStart && periodEnd && periodEnd > periodStart);

  function resetForm() {
    setPeriodStart("");
    setPeriodEnd(today());
    setPreview(null);
    setPreviewError(null);
  }

  function handlePreview() {
    setPreviewError(null);
    startPreviewTransition(async () => {
      const result = await previewDoctorSettlement(doctorId);
      if (result.error || !result.preview) {
        setPreview(null);
        setPreviewError(result.error ?? "Couldn't load a preview.");
        return;
      }
      if (result.preview.entries.length === 0) {
        setPreview(null);
        setPreviewError("There's nothing pending to settle for this doctor.");
        return;
      }
      setPreview(result.preview);
    });
  }

  function handleConfirm() {
    startRunTransition(async () => {
      const result = await runDoctorSettlement(doctorId, periodStart, periodEnd);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Settlement run");
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
      <SheetTrigger render={<Button />}>
        <HandCoins className="size-4" />
        Run Settlement
      </SheetTrigger>
      <SheetContent className="sm:max-w-md" side="right">
        <SheetHeader>
          <SheetTitle>Run Settlement</SheetTitle>
          <SheetDescription>
            Sweeps every pending, resolved earning for Dr. {doctorName} into one statement. This is immutable — it
            cannot be undone once run.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="period_start">Period start *</Label>
              <Input
                id="period_start"
                type="date"
                value={periodStart}
                onChange={(event) => setPeriodStart(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="period_end">Period end *</Label>
              <Input
                id="period_end"
                type="date"
                value={periodEnd}
                onChange={(event) => setPeriodEnd(event.target.value)}
              />
            </div>
          </div>

          <Button type="button" variant="outline" disabled={pending} onClick={handlePreview}>
            {previewPending && <Loader2 className="size-4 animate-spin" />}
            Preview pending total
          </Button>

          {previewError && (
            <p className="text-sm text-destructive" role="alert">
              {previewError}
            </p>
          )}

          {preview && (
            <div className="rounded-xl bg-muted p-3 text-sm">
              {preview.entries.length} pending entr{preview.entries.length === 1 ? "y" : "ies"} totalling{" "}
              <span className="font-semibold tabular-nums">{formatCurrency(preview.total)}</span>.
            </div>
          )}

          <div className="mt-auto flex justify-end gap-2 pt-2 pb-4">
            <SheetClose render={<Button type="button" variant="outline" disabled={pending} />}>Cancel</SheetClose>
            <Button type="button" disabled={pending || !preview || !periodValid} onClick={handleConfirm}>
              {runPending && <Loader2 className="size-4 animate-spin" />}
              Confirm & Run Settlement
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

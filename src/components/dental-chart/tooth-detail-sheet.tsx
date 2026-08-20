"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { CalendarDays, CircleCheck, Loader2, Pencil, Stethoscope } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { EmptyState } from "@/components/ui/empty-state";
import { ToothConditionBadge, ToothStatusBadge } from "@/components/dental-chart/tooth-badges";
import { loadToothDetail, updateToothState, setToothStatus, createToothObservation } from "@/lib/dental-chart/actions";
import { describeToothEvent } from "@/lib/dental-chart/calculations";
import { useTranslation } from "@/components/locale-provider";
import type { ToothCondition, ToothStatus } from "@/types/domain";
import type { ToothDetail } from "@/lib/dental-chart/queries";
import type { Dictionary } from "@/lib/i18n/types";

const NO_CONDITION = "__none__";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function eventSummary(event: ToothDetail["events"][number], dict: Dictionary["dentalChart"]): string {
  return describeToothEvent(event, {
    status: dict.toothStatus,
    condition: dict.toothCondition,
    presentNoCondition: dict.presentNoCondition,
    observationFallback: dict.events.observationFallback,
    healthy: dict.events.healthy,
    stateUpdated: dict.events.stateUpdated,
    markedStatusTemplate: dict.events.markedStatusTemplate,
    conditionChangeConnector: dict.events.conditionChangeConnector,
  });
}

/**
 * The Tooth Sheet — a controlled Sheet (no self-trigger; the Odontogram owns
 * which tooth is selected), everything inline, zero nested Dialogs. Fetches
 * on demand per selected tooth via the loadToothDetail server action, since
 * queries.ts is server-only and this is a Client Component.
 */
export function ToothDetailSheet({
  patientId,
  fdiNumber,
  open,
  onOpenChange,
  canEdit,
}: {
  patientId: string;
  fdiNumber: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canEdit: boolean;
}) {
  const router = useRouter();
  const { dentalChart: dict } = useTranslation();
  const [pending, startTransition] = useTransition();
  const [detail, setDetail] = useState<ToothDetail | null>(null);
  // Which tooth `detail` was actually loaded for — compared against
  // `fdiNumber` below to derive `loading` during render instead of storing a
  // separate boolean set from inside the effect (react-hooks/set-state-in-effect).
  const [loadedForFdiNumber, setLoadedForFdiNumber] = useState<number | null>(null);
  const [editingState, setEditingState] = useState(false);
  const [statusDraft, setStatusDraft] = useState<ToothStatus>("present");
  const [conditionDraft, setConditionDraft] = useState<string>(NO_CONDITION);
  const [notesDraft, setNotesDraft] = useState("");
  const [addingObservation, setAddingObservation] = useState(false);
  const [observationDraft, setObservationDraft] = useState("");

  const loading = open && fdiNumber !== null && loadedForFdiNumber !== fdiNumber;

  useEffect(() => {
    if (!open || fdiNumber === null) return;
    let cancelled = false;
    loadToothDetail(patientId, fdiNumber).then((result) => {
      if (cancelled) return;
      setDetail(result);
      setLoadedForFdiNumber(fdiNumber);
      setStatusDraft(result?.state?.status ?? "present");
      setConditionDraft(result?.state?.condition ?? NO_CONDITION);
      setNotesDraft(result?.state?.notes ?? "");
      setEditingState(false);
      setAddingObservation(false);
    });
    return () => {
      cancelled = true;
    };
  }, [open, fdiNumber, patientId]);

  function refresh() {
    if (fdiNumber === null) return;
    loadToothDetail(patientId, fdiNumber).then(setDetail);
    router.refresh();
  }

  function handleSaveState() {
    if (fdiNumber === null) return;
    const formData = new FormData();
    formData.set("status", statusDraft);
    formData.set("condition", conditionDraft === NO_CONDITION ? "" : conditionDraft);
    formData.set("notes", notesDraft);
    startTransition(async () => {
      const result = await updateToothState(patientId, fdiNumber, formData);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(dict.toast.updated);
        setEditingState(false);
        refresh();
      }
    });
  }

  function handleMarkMissing() {
    if (fdiNumber === null) return;
    startTransition(async () => {
      const result = await setToothStatus(patientId, fdiNumber, "missing");
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(dict.toast.markedMissing);
        refresh();
      }
    });
  }

  function handleAddObservation() {
    if (fdiNumber === null || !observationDraft.trim()) return;
    const formData = new FormData();
    formData.set("notes", observationDraft);
    startTransition(async () => {
      const result = await createToothObservation(patientId, fdiNumber, formData);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(dict.toast.observationAdded);
        setObservationDraft("");
        setAddingObservation(false);
        refresh();
      }
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col overflow-y-auto" side="right">
        {fdiNumber === null ? null : (
          <>
            <SheetHeader>
              <SheetTitle className="flex items-baseline gap-2">
                {dict.toothAriaPrefix} {fdiNumber}
                {detail && (detail.universalLabel || detail.palmerLabel) && (
                  <span className="text-sm font-normal text-muted-foreground">
                    {[
                      detail.universalLabel && `${dict.universalPrefix} ${detail.universalLabel}`,
                      detail.palmerLabel && `${dict.palmerPrefix} ${detail.palmerLabel}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                )}
              </SheetTitle>
              <SheetDescription>
                {detail
                  ? `${detail.dentition === "primary" ? dict.dentition.primary : dict.dentition.permanent} · ${detail.arch === "upper" ? dict.arch.upper : dict.arch.lower}`
                  : dict.sheet.loading}
              </SheetDescription>
            </SheetHeader>

            <div className="flex-1 space-y-5 px-5 pb-5">
              {loading && !detail ? (
                <div className="flex items-center justify-center py-10 text-muted-foreground">
                  <Loader2 className="size-5 animate-spin" />
                </div>
              ) : (
                <>
                  {/* Current state */}
                  <section className="space-y-2 rounded-xl border border-border p-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium">{dict.sheet.currentState}</h3>
                      {canEdit && !editingState && (
                        <Button variant="ghost" size="sm" onClick={() => setEditingState(true)}>
                          <Pencil className="size-3.5" />
                          {dict.sheet.edit}
                        </Button>
                      )}
                    </div>

                    {editingState ? (
                      <div className="space-y-2.5">
                        <Select items={dict.toothStatus} value={statusDraft} onValueChange={(v) => v && setStatusDraft(v as ToothStatus)}>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(Object.entries(dict.toothStatus) as [ToothStatus, string][]).map(([value, label]) => (
                              <SelectItem key={value} value={value}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select
                          items={{ [NO_CONDITION]: dict.sheet.noConditionHealthy, ...dict.toothCondition }}
                          value={conditionDraft}
                          onValueChange={(v) => v && setConditionDraft(v)}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NO_CONDITION}>{dict.sheet.noConditionHealthy}</SelectItem>
                            {(Object.entries(dict.toothCondition) as [ToothCondition, string][]).map(([value, label]) => (
                              <SelectItem key={value} value={value}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Textarea
                          value={notesDraft}
                          onChange={(e) => setNotesDraft(e.target.value)}
                          placeholder={dict.sheet.notesPlaceholder}
                          rows={2}
                        />
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" disabled={pending} onClick={() => setEditingState(false)}>
                            {dict.sheet.cancel}
                          </Button>
                          <Button size="sm" disabled={pending} onClick={handleSaveState}>
                            {pending && <Loader2 className="size-3.5 animate-spin" />}
                            {dict.sheet.save}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <ToothStatusBadge status={detail?.state?.status ?? "present"} />
                          {detail?.state?.condition && <ToothConditionBadge condition={detail.state.condition} />}
                        </div>
                        {detail?.state?.notes && <p className="text-sm text-muted-foreground">{detail.state.notes}</p>}
                        {canEdit && (!detail?.state || detail.state.status === "present") && (
                          <Button variant="outline" size="sm" disabled={pending} onClick={handleMarkMissing}>
                            {dict.sheet.markMissing}
                          </Button>
                        )}
                      </div>
                    )}
                  </section>

                  {/* Planned treatment */}
                  <section className="space-y-2">
                    <h3 className="text-sm font-medium">{dict.sheet.plannedTreatment}</h3>
                    {detail && detail.plannedItems.length > 0 ? (
                      <ul className="space-y-1.5">
                        {detail.plannedItems.map((item) => (
                          <li key={item.id}>
                            <Link
                              href={`/patients/${patientId}/treatment-plans/${item.planId}`}
                              className="flex items-center justify-between rounded-lg border border-border p-2.5 text-sm hover:bg-muted/40"
                            >
                              <span>{item.procedureName}</span>
                              <Badge variant="outline">{item.status}</Badge>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted-foreground">{dict.sheet.nothingPlanned}</p>
                    )}
                  </section>

                  {/* Performed treatment */}
                  <section className="space-y-2">
                    <h3 className="text-sm font-medium">{dict.sheet.performedTreatment}</h3>
                    {detail && detail.performedRecords.length > 0 ? (
                      <ul className="space-y-1.5">
                        {detail.performedRecords.map((record) => (
                          <li key={record.id}>
                            <Link
                              href={`/patients/${patientId}?tab=procedures-performed`}
                              className="flex items-center justify-between gap-2 rounded-lg border border-border p-2.5 text-sm hover:bg-muted/40"
                            >
                              <span className="flex items-center gap-1.5">
                                <CircleCheck className="size-3.5 text-success-text" />
                                {record.procedureName}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {formatDate(record.performedAt)}
                                {record.doctorName && ` · ${dict.sheet.doctorPrefix} ${record.doctorName}`}
                              </span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted-foreground">{dict.sheet.nothingPerformed}</p>
                    )}
                  </section>

                  {/* History */}
                  <section className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium">{dict.sheet.history}</h3>
                      {canEdit && !addingObservation && (
                        <Button variant="ghost" size="sm" onClick={() => setAddingObservation(true)}>
                          <Stethoscope className="size-3.5" />
                          {dict.sheet.addObservation}
                        </Button>
                      )}
                    </div>

                    {addingObservation && (
                      <div className="space-y-2 rounded-lg border border-border p-2.5">
                        <Textarea
                          value={observationDraft}
                          onChange={(e) => setObservationDraft(e.target.value)}
                          placeholder={dict.sheet.observationPlaceholder}
                          rows={2}
                        />
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" disabled={pending} onClick={() => setAddingObservation(false)}>
                            {dict.sheet.cancel}
                          </Button>
                          <Button size="sm" disabled={pending || !observationDraft.trim()} onClick={handleAddObservation}>
                            {pending && <Loader2 className="size-3.5 animate-spin" />}
                            {dict.sheet.save}
                          </Button>
                        </div>
                      </div>
                    )}

                    {detail && detail.events.length > 0 ? (
                      <ol className="space-y-2 border-s border-border ps-4">
                        {detail.events.map((event) => (
                          <li key={event.id} className="relative">
                            <span
                              className="absolute -start-[calc(1rem+3.5px)] top-1 size-1.5 rounded-full bg-border"
                              aria-hidden="true"
                            />
                            <p className="text-sm">{eventSummary(event, dict)}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatDateTime(event.created_at)}
                              {event.appointment_id && (
                                <>
                                  {" · "}
                                  <CalendarDays className="inline size-3" /> {dict.sheet.linkedToVisit}
                                </>
                              )}
                            </p>
                          </li>
                        ))}
                      </ol>
                    ) : (
                      !addingObservation && <EmptyState title={dict.sheet.noHistory} />
                    )}
                  </section>
                </>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

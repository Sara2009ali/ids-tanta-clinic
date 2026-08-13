"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import { CalendarDays, CircleCheck, Loader2, Pencil, Stethoscope } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { EmptyState } from "@/components/ui/empty-state";
import { ToothConditionBadge, ToothStatusBadge } from "@/components/dental-chart/tooth-badges";
import { loadToothDetail, updateToothState, setToothStatus, createToothObservation } from "@/lib/dental-chart/actions";
import {
  TOOTH_CONDITION_LABELS,
  TOOTH_STATUS_LABELS,
  type ToothCondition,
  type ToothStatus,
} from "@/types/domain";
import type { ToothDetail } from "@/lib/dental-chart/queries";

const NO_CONDITION = "__none__";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function eventSummary(event: ToothDetail["events"][number]): string {
  if (event.event_type === "observation") return event.notes ?? "Observation recorded";
  const from = event.previous_condition ? TOOTH_CONDITION_LABELS[event.previous_condition as ToothCondition] : "Healthy";
  const to = event.condition ? TOOTH_CONDITION_LABELS[event.condition as ToothCondition] : "Healthy";
  const statusChanged = event.previous_status !== event.status;
  if (statusChanged && event.status) {
    return `Marked ${TOOTH_STATUS_LABELS[event.status as ToothStatus]}`;
  }
  return from === to ? "State updated" : `${from} → ${to}`;
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
        toast.success("Tooth updated");
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
        toast.success("Tooth marked missing");
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
        toast.success("Observation added");
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
                Tooth {fdiNumber}
                {detail && (detail.universalLabel || detail.palmerLabel) && (
                  <span className="text-sm font-normal text-muted-foreground">
                    {[detail.universalLabel && `Universal ${detail.universalLabel}`, detail.palmerLabel && `Palmer ${detail.palmerLabel}`]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                )}
              </SheetTitle>
              <SheetDescription>
                {detail ? `${detail.dentition === "primary" ? "Primary" : "Permanent"} · ${detail.arch === "upper" ? "Upper" : "Lower"} arch` : "Loading…"}
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
                      <h3 className="text-sm font-medium">Current state</h3>
                      {canEdit && !editingState && (
                        <Button variant="ghost" size="sm" onClick={() => setEditingState(true)}>
                          <Pencil className="size-3.5" />
                          Edit
                        </Button>
                      )}
                    </div>

                    {editingState ? (
                      <div className="space-y-2.5">
                        <Select items={TOOTH_STATUS_LABELS} value={statusDraft} onValueChange={(v) => v && setStatusDraft(v as ToothStatus)}>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(Object.entries(TOOTH_STATUS_LABELS) as [ToothStatus, string][]).map(([value, label]) => (
                              <SelectItem key={value} value={value}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select
                          items={{ [NO_CONDITION]: "No condition (healthy)", ...TOOTH_CONDITION_LABELS }}
                          value={conditionDraft}
                          onValueChange={(v) => v && setConditionDraft(v)}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NO_CONDITION}>No condition (healthy)</SelectItem>
                            {(Object.entries(TOOTH_CONDITION_LABELS) as [ToothCondition, string][]).map(([value, label]) => (
                              <SelectItem key={value} value={value}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Textarea
                          value={notesDraft}
                          onChange={(e) => setNotesDraft(e.target.value)}
                          placeholder="Notes"
                          rows={2}
                        />
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" disabled={pending} onClick={() => setEditingState(false)}>
                            Cancel
                          </Button>
                          <Button size="sm" disabled={pending} onClick={handleSaveState}>
                            {pending && <Loader2 className="size-3.5 animate-spin" />}
                            Save
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
                            Mark missing
                          </Button>
                        )}
                      </div>
                    )}
                  </section>

                  {/* Planned treatment */}
                  <section className="space-y-2">
                    <h3 className="text-sm font-medium">Planned treatment</h3>
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
                      <p className="text-sm text-muted-foreground">Nothing currently planned for this tooth.</p>
                    )}
                  </section>

                  {/* Performed treatment */}
                  <section className="space-y-2">
                    <h3 className="text-sm font-medium">Performed treatment</h3>
                    {detail && detail.performedRecords.length > 0 ? (
                      <ul className="space-y-1.5">
                        {detail.performedRecords.map((record) => (
                          <li
                            key={record.id}
                            className="flex items-center justify-between gap-2 rounded-lg border border-border p-2.5 text-sm"
                          >
                            <span className="flex items-center gap-1.5">
                              <CircleCheck className="size-3.5 text-success-text" />
                              {record.procedureName}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatDate(record.performedAt)}
                              {record.doctorName && ` · Dr. ${record.doctorName}`}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted-foreground">Nothing recorded as performed on this tooth yet.</p>
                    )}
                  </section>

                  {/* History */}
                  <section className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium">History</h3>
                      {canEdit && !addingObservation && (
                        <Button variant="ghost" size="sm" onClick={() => setAddingObservation(true)}>
                          <Stethoscope className="size-3.5" />
                          Add observation
                        </Button>
                      )}
                    </div>

                    {addingObservation && (
                      <div className="space-y-2 rounded-lg border border-border p-2.5">
                        <Textarea
                          value={observationDraft}
                          onChange={(e) => setObservationDraft(e.target.value)}
                          placeholder="What did you observe?"
                          rows={2}
                        />
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" disabled={pending} onClick={() => setAddingObservation(false)}>
                            Cancel
                          </Button>
                          <Button size="sm" disabled={pending || !observationDraft.trim()} onClick={handleAddObservation}>
                            {pending && <Loader2 className="size-3.5 animate-spin" />}
                            Save
                          </Button>
                        </div>
                      </div>
                    )}

                    {detail && detail.events.length > 0 ? (
                      <ol className="space-y-2 border-l border-border pl-4">
                        {detail.events.map((event) => (
                          <li key={event.id} className="relative">
                            <span
                              className="absolute -left-[calc(1rem+3.5px)] top-1 size-1.5 rounded-full bg-border"
                              aria-hidden="true"
                            />
                            <p className="text-sm">{eventSummary(event)}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatDateTime(event.created_at)}
                              {event.appointment_id && (
                                <>
                                  {" · "}
                                  <CalendarDays className="inline size-3" /> Linked to a visit
                                </>
                              )}
                            </p>
                          </li>
                        ))}
                      </ol>
                    ) : (
                      !addingObservation && <EmptyState title="No history recorded yet" />
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

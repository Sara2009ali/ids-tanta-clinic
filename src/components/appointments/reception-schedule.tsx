"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { TodaysSchedule } from "@/components/appointments/todays-schedule";
import { AppointmentRowActions } from "@/components/appointments/appointment-row-actions";
import { useTranslation } from "@/components/locale-provider";
import type { ScheduleRow } from "@/lib/appointments/queries";
import type { Chair, TreatmentRecord, VisitType } from "@/types/domain";
import type { DoctorOption } from "@/lib/patients/queries";
import type { Dictionary } from "@/lib/i18n/types";

type FilterKey = "all" | "upcoming" | "completed" | "cancelled" | "no_show";

function filterList(dict: Dictionary["reception"]["filters"]): { key: FilterKey; label: string }[] {
  return [
    { key: "all", label: dict.all },
    { key: "upcoming", label: dict.upcoming },
    { key: "completed", label: dict.completed },
    { key: "cancelled", label: dict.cancelled },
    { key: "no_show", label: dict.noShow },
  ];
}

const CLOSED_STATUSES = new Set(["completed", "cancelled", "no_show"]);

function matchesFilter(row: ScheduleRow, filter: FilterKey, now: number): boolean {
  switch (filter) {
    case "all":
      return true;
    case "upcoming":
      return new Date(row.scheduled_start).getTime() > now && !CLOSED_STATUSES.has(row.status);
    case "completed":
      return row.status === "completed";
    case "cancelled":
      return row.status === "cancelled";
    case "no_show":
      return row.status === "no_show";
  }
}

/**
 * Filters client-side over the single already-fetched `rows` array — no
 * extra round trip per filter click, since today's full schedule is
 * already loaded server-side for the page. "Today" (all) is the default,
 * matching the Reception Workspace's whole-page scope.
 */
export function ReceptionSchedule({
  rows,
  doctors,
  chairs,
  visitTypes,
  treatmentRecordsByAppointmentId,
  invoiceIdByAppointmentId,
  permissions,
}: {
  rows: ScheduleRow[];
  doctors: DoctorOption[];
  chairs: Chair[];
  visitTypes: VisitType[];
  treatmentRecordsByAppointmentId: Record<string, TreatmentRecord[]>;
  invoiceIdByAppointmentId: Record<string, string>;
  permissions: string[];
}) {
  const dict = useTranslation();
  const t = dict.reception;
  const tAppointments = dict.appointments;
  const [filter, setFilter] = useState<FilterKey>("all");
  // Captured once via useState's lazy initializer (the sanctioned way to
  // read an impure value exactly once) rather than re-evaluated live —
  // good enough for a quick filter toggle; the page's own data refreshes
  // (router.refresh()) after any status action anyway.
  const [now] = useState(() => Date.now());

  const filteredRows = useMemo(() => rows.filter((row) => matchesFilter(row, filter, now)), [rows, filter, now]);
  const filters = filterList(t.filters);

  return (
    <div className="space-y-3">
      <div className="flex w-fit flex-wrap gap-1 rounded-lg bg-muted p-[3px]">
        {filters.map(({ key, label }) => {
          const count = rows.filter((row) => matchesFilter(row, key, now)).length;
          return (
            <Button
              key={key}
              type="button"
              size="sm"
              variant={filter === key ? "default" : "ghost"}
              onClick={() => setFilter(key)}
            >
              {label} ({count})
            </Button>
          );
        })}
      </div>

      <TodaysSchedule
        rows={filteredRows}
        emptyMessage={t.filteredEmptyMessage}
        doctorPrefix={tAppointments.doctorPrefix}
        emergencyLabel={tAppointments.emergencyBadge}
        urgentLabel={tAppointments.urgentBadge}
        highPriorityLabel={tAppointments.highPriorityBadge}
        renderActions={(row) => (
          <AppointmentRowActions
            appointment={row}
            doctors={doctors}
            chairs={chairs}
            visitTypes={visitTypes}
            treatmentRecords={treatmentRecordsByAppointmentId[row.id] ?? []}
            invoiceId={invoiceIdByAppointmentId[row.id] ?? null}
            permissions={permissions}
          />
        )}
      />
    </div>
  );
}

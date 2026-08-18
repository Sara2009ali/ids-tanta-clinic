"use client";

import { useState } from "react";
import { AlertTriangle, CircleCheck } from "lucide-react";
import { Odontogram } from "@/components/dental-chart/odontogram";
import { ToothDetailSheet } from "@/components/dental-chart/tooth-detail-sheet";
import { toothNeedsAttention } from "@/lib/dental-chart/calculations";
import type { DentalChartToothSummary } from "@/lib/dental-chart/queries";

/**
 * Patient Profile's Dental Chart tab content — no dedicated route (per the
 * approved UX), so this is the whole feature: a stat line, the odontogram,
 * and the controlled tooth Sheet it opens.
 */
export function DentalChart({
  patientId,
  teeth,
  canEdit,
}: {
  patientId: string;
  teeth: DentalChartToothSummary[];
  canEdit: boolean;
}) {
  const [selectedFdiNumber, setSelectedFdiNumber] = useState<number | null>(null);
  const attentionCount = teeth.filter(toothNeedsAttention).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm">
        {attentionCount > 0 ? (
          <>
            <AlertTriangle className="size-4 text-warning-text" />
            <span className="text-foreground">
              {attentionCount} {attentionCount === 1 ? "tooth needs" : "teeth need"} attention
            </span>
          </>
        ) : (
          <>
            <CircleCheck className="size-4 text-success-text" />
            <span className="text-muted-foreground">No teeth currently need attention</span>
          </>
        )}
      </div>

      <Odontogram
        patientId={patientId}
        teeth={teeth}
        selectedFdiNumber={selectedFdiNumber}
        onSelectTooth={setSelectedFdiNumber}
      />

      <ToothDetailSheet
        patientId={patientId}
        fdiNumber={selectedFdiNumber}
        open={selectedFdiNumber !== null}
        onOpenChange={(open) => !open && setSelectedFdiNumber(null)}
        canEdit={canEdit}
      />
    </div>
  );
}

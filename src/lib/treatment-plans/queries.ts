import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  computeEstimatedTotal,
  computeItemProgress,
  groupPerformedTreatmentRecordsByItem,
  orderItemsBySequence,
  type PerformedTreatmentInfo,
} from "@/lib/treatment-plans/calculations";
import type { AppointmentStatus, TreatmentPlan, TreatmentPlanItem } from "@/types/domain";

export interface TreatmentPlanListRow extends TreatmentPlan {
  itemCount: number;
  acceptedCount: number;
  completedCount: number;
  acceptedPercent: number;
  completedPercent: number;
  estimatedTotal: number;
}

/** A patient's treatment plans, most recent first, with per-plan item-progress indicators — for Patient Profile's Treatment Plans tab. */
export async function getTreatmentPlansForPatient(patientId: string): Promise<TreatmentPlanListRow[]> {
  const supabase = await createClient();

  const { data: plans, error } = await supabase
    .from("treatment_plans")
    .select("*")
    .eq("patient_id", patientId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getTreatmentPlansForPatient failed", error);
    return [];
  }
  if (!plans || plans.length === 0) return [];

  const { data: items, error: itemsError } = await supabase
    .from("treatment_plan_items")
    .select("treatment_plan_id, status, estimated_price, quantity")
    .in(
      "treatment_plan_id",
      plans.map((plan) => plan.id),
    );

  if (itemsError) {
    console.error("getTreatmentPlansForPatient: item lookup failed", itemsError);
  }

  const itemsByPlan = new Map<string, { status: string; estimated_price: number; quantity: number }[]>();
  for (const item of items ?? []) {
    const existing = itemsByPlan.get(item.treatment_plan_id) ?? [];
    existing.push({ status: item.status, estimated_price: item.estimated_price, quantity: item.quantity });
    itemsByPlan.set(item.treatment_plan_id, existing);
  }

  return plans.map((plan) => {
    const planItems = itemsByPlan.get(plan.id) ?? [];
    const progress = computeItemProgress(planItems);
    return {
      ...plan,
      itemCount: progress.totalCount,
      acceptedCount: progress.acceptedCount,
      completedCount: progress.completedCount,
      acceptedPercent: progress.acceptedPercent,
      completedPercent: progress.completedPercent,
      estimatedTotal: computeEstimatedTotal(planItems),
    };
  });
}

export interface TreatmentPlanItemWithContext extends TreatmentPlanItem {
  appointmentScheduledStart: string | null;
  /** The linked appointment's current status, if any — powers the Record Treatment action's eligibility gate (isAppointmentTreatmentEligible). Null when the item has no appointment_id. */
  appointmentStatus: AppointmentStatus | null;
  /** Every active (non-soft-deleted) treatment_records row that fulfills this item — see groupPerformedTreatmentRecordsByItem. Empty when nothing has been performed yet. */
  performed: PerformedTreatmentInfo[];
}

export interface TreatmentPlanDetail extends TreatmentPlan {
  patientName: string;
  patientNumber: string;
  items: TreatmentPlanItemWithContext[];
}

interface TreatmentPlanDetailQueryRow extends TreatmentPlan {
  patients: { full_name: string; patient_number: string } | null;
}

interface TreatmentPlanItemQueryRow extends TreatmentPlanItem {
  appointments: { scheduled_start: string; status: AppointmentStatus } | null;
}

/** Full plan detail — the plan row, its patient display info, and every item in sequence order with linked-appointment/performed-treatment context resolved — for the dedicated Treatment Plan detail page. */
export async function getTreatmentPlanDetail(planId: string): Promise<TreatmentPlanDetail | null> {
  const supabase = await createClient();

  const [planRes, itemsRes] = await Promise.all([
    supabase
      .from("treatment_plans")
      .select("*, patients ( full_name, patient_number )")
      .eq("id", planId)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase
      .from("treatment_plan_items")
      .select("*, appointments ( scheduled_start, status )")
      .eq("treatment_plan_id", planId)
      .order("sequence", { ascending: true }),
  ]);

  if (planRes.error || !planRes.data) {
    if (planRes.error) console.error("getTreatmentPlanDetail failed", planRes.error);
    return null;
  }
  if (itemsRes.error) {
    console.error("getTreatmentPlanDetail: item lookup failed", itemsRes.error);
  }

  const itemRows = (itemsRes.data ?? []) as unknown as TreatmentPlanItemQueryRow[];
  const itemIds = itemRows.map((row) => row.id);

  let performedByItem = new Map<string, PerformedTreatmentInfo[]>();
  if (itemIds.length > 0) {
    const { data: performedRows, error: performedError } = await supabase
      .from("treatment_records")
      .select("id, treatment_plan_item_id, created_at")
      .in("treatment_plan_item_id", itemIds)
      .is("deleted_at", null);

    if (performedError) {
      console.error("getTreatmentPlanDetail: performed-treatment lookup failed", performedError);
    } else {
      performedByItem = groupPerformedTreatmentRecordsByItem(performedRows ?? []);
    }
  }

  const { patients, ...plan } = planRes.data as unknown as TreatmentPlanDetailQueryRow;

  const items: TreatmentPlanItemWithContext[] = orderItemsBySequence(itemRows).map((row) => {
    const { appointments, ...item } = row;
    return {
      ...item,
      appointmentScheduledStart: appointments?.scheduled_start ?? null,
      appointmentStatus: appointments?.status ?? null,
      performed: performedByItem.get(row.id) ?? [],
    };
  });

  return {
    ...plan,
    patientName: patients?.full_name ?? "—",
    patientNumber: patients?.patient_number ?? "",
    items,
  };
}

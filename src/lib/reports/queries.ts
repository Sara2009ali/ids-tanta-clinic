import "server-only";

import { createClient } from "@/lib/supabase/server";
import { rangeToTimestampBounds, type ReportDateRange } from "@/lib/reports/date-range";

/**
 * Reports & Analytics data layer. Per the approved architecture: every
 * figure here either reuses an existing module's own query/definition
 * directly (Outstanding balances = getBillingDashboardCounts()'s own
 * number, Compensation summary = getClinicCompensationSummary()'s own
 * numbers — imported from those modules, not reimplemented) or follows the
 * exact "fetch rows in range, reduce in JS" convention already established
 * by getBillingDashboardCounts()/getClinicCompensationSummary()/
 * getDoctorsPendingTotals(), just parameterized by an arbitrary caller-
 * supplied range instead of a fixed "today"/"this month" window.
 * report_revenue_series() (0017_reports.sql) is the one exception, for the
 * one report that's genuinely a GROUP BY, not a plain sum.
 */

// ---------------------------------------------------------------------------
// Revenue — "completed payments," Billing's own definition
// (getBillingDashboardCounts()'s paidThisMonth), generalized to any range.
// ---------------------------------------------------------------------------

/** Sum of payments.amount, deleted_at is null, in range — same query shape as getBillingDashboardCounts()'s paidThisMonth, no `type` filter, replicated faithfully. */
export async function getRevenueTotal(range: ReportDateRange): Promise<number> {
  const supabase = await createClient();
  const { startIso, endIsoExclusive } = rangeToTimestampBounds(range);

  const { data, error } = await supabase
    .from("payments")
    .select("amount")
    .is("deleted_at", null)
    .gte("paid_at", startIso)
    .lt("paid_at", endIsoExclusive);

  if (error) {
    console.error("getRevenueTotal failed", error);
    return 0;
  }
  return (data ?? []).reduce((sum, row) => sum + Number(row.amount), 0);
}

export interface RevenueBucket {
  bucketStart: string;
  revenue: number;
}

export type RevenueBucketGranularity = "day" | "week" | "month" | "year";

/** Only the report that genuinely needs a date_trunc()-grouped aggregate — see report_revenue_series() (0017_reports.sql). Only buckets with at least one payment are returned; zero-revenue gaps aren't filled in (no chart consumes this yet to need it). */
export async function getRevenueSeries(
  clinicId: string,
  range: ReportDateRange,
  bucket: RevenueBucketGranularity,
): Promise<RevenueBucket[]> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("report_revenue_series", {
    p_clinic_id: clinicId,
    p_start: range.start,
    p_end: range.end,
    p_bucket: bucket,
  });

  if (error) {
    console.error("getRevenueSeries failed", error);
    return [];
  }

  return (data ?? []).map((row) => ({ bucketStart: row.bucket_start, revenue: Number(row.revenue) }));
}

// ---------------------------------------------------------------------------
// Appointments
// ---------------------------------------------------------------------------

/** Cheap head-count for the hub KPI — the full Appointments report page reuses getScheduleForRange() directly instead, for the joined rows it actually needs to break down by status/doctor. */
export async function getAppointmentCount(range: ReportDateRange): Promise<number> {
  const supabase = await createClient();
  const { startIso, endIsoExclusive } = rangeToTimestampBounds(range);

  const { count, error } = await supabase
    .from("appointments")
    .select("*", { count: "exact", head: true })
    .is("deleted_at", null)
    .gte("scheduled_start", startIso)
    .lt("scheduled_start", endIsoExclusive);

  if (error) {
    console.error("getAppointmentCount failed", error);
    return 0;
  }
  return count ?? 0;
}

export interface CancellationStats {
  totalCount: number;
  cancelledCount: number;
  noShowCount: number;
}

export async function getCancellationStats(range: ReportDateRange): Promise<CancellationStats> {
  const supabase = await createClient();
  const { startIso, endIsoExclusive } = rangeToTimestampBounds(range);

  const [totalRes, cancelledRes, noShowRes] = await Promise.all([
    supabase
      .from("appointments")
      .select("*", { count: "exact", head: true })
      .is("deleted_at", null)
      .gte("scheduled_start", startIso)
      .lt("scheduled_start", endIsoExclusive),
    supabase
      .from("appointments")
      .select("*", { count: "exact", head: true })
      .is("deleted_at", null)
      .eq("status", "cancelled")
      .gte("scheduled_start", startIso)
      .lt("scheduled_start", endIsoExclusive),
    supabase
      .from("appointments")
      .select("*", { count: "exact", head: true })
      .is("deleted_at", null)
      .eq("status", "no_show")
      .gte("scheduled_start", startIso)
      .lt("scheduled_start", endIsoExclusive),
  ]);

  return {
    totalCount: totalRes.count ?? 0,
    cancelledCount: cancelledRes.count ?? 0,
    noShowCount: noShowRes.count ?? 0,
  };
}

export interface CancellationRow {
  appointmentId: string;
  toStatus: string;
  note: string | null;
  changedAt: string;
}

/** appointment_status_history rows landing on cancelled/no_show in range, most recent first — same table Compensation's own audit patterns already read (a different one, appointment_status_history, but the same "history table as report source" shape). */
export async function getCancellationHistory(range: ReportDateRange): Promise<CancellationRow[]> {
  const supabase = await createClient();
  const { startIso, endIsoExclusive } = rangeToTimestampBounds(range);

  const { data, error } = await supabase
    .from("appointment_status_history")
    .select("appointment_id, to_status, note, created_at")
    .in("to_status", ["cancelled", "no_show"])
    .gte("created_at", startIso)
    .lt("created_at", endIsoExclusive)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getCancellationHistory failed", error);
    return [];
  }

  return (data ?? []).map((row) => ({
    appointmentId: row.appointment_id,
    toStatus: row.to_status,
    note: row.note,
    changedAt: row.created_at,
  }));
}

// ---------------------------------------------------------------------------
// Patients
// ---------------------------------------------------------------------------

/** Cheap head-count for the hub KPI. */
export async function getNewPatientCount(range: ReportDateRange): Promise<number> {
  const supabase = await createClient();
  const { startIso, endIsoExclusive } = rangeToTimestampBounds(range);

  const { count, error } = await supabase
    .from("patients")
    .select("*", { count: "exact", head: true })
    .gte("created_at", startIso)
    .lt("created_at", endIsoExclusive);

  if (error) {
    console.error("getNewPatientCount failed", error);
    return 0;
  }
  return count ?? 0;
}

export interface PatientGrowthPoint {
  day: string;
  count: number;
}

/** Day-bucketed new-patient counts — plain JS reduce over created_at, no RPC needed at this app's established scale (unlike revenue, this wasn't approved as an RPC and doesn't need to be — patient-creation volume is far lower than payment volume). */
export async function getPatientGrowth(range: ReportDateRange): Promise<PatientGrowthPoint[]> {
  const supabase = await createClient();
  const { startIso, endIsoExclusive } = rangeToTimestampBounds(range);

  const { data, error } = await supabase
    .from("patients")
    .select("created_at")
    .gte("created_at", startIso)
    .lt("created_at", endIsoExclusive);

  if (error) {
    console.error("getPatientGrowth failed", error);
    return [];
  }

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    const day = row.created_at.slice(0, 10);
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([day, count]) => ({ day, count }))
    .sort((a, b) => a.day.localeCompare(b.day));
}

export interface PatientRetentionSummary {
  newCount: number;
  returningCount: number;
}

/**
 * "Returning" per the approved architecture: a patient with an appointment
 * in this range who already had a *completed* appointment before the range
 * started. Two round trips — distinct patients seen in the range, then
 * which of those were already seen before it — since nothing else in this
 * app computes this; the one genuinely new computation in this module.
 * The second query is scoped to exactly the patient ids seen in-range
 * (never "every patient ever"), keeping it bounded regardless of clinic age.
 */
export async function getPatientRetentionSummary(range: ReportDateRange): Promise<PatientRetentionSummary> {
  const supabase = await createClient();
  const { startIso, endIsoExclusive } = rangeToTimestampBounds(range);

  const { data: periodRows, error: periodError } = await supabase
    .from("appointments")
    .select("patient_id")
    .is("deleted_at", null)
    .gte("scheduled_start", startIso)
    .lt("scheduled_start", endIsoExclusive);

  if (periodError) {
    console.error("getPatientRetentionSummary failed", periodError);
    return { newCount: 0, returningCount: 0 };
  }

  const patientIds = Array.from(new Set((periodRows ?? []).map((row) => row.patient_id)));
  if (patientIds.length === 0) return { newCount: 0, returningCount: 0 };

  const { data: priorRows, error: priorError } = await supabase
    .from("appointments")
    .select("patient_id")
    .is("deleted_at", null)
    .eq("status", "completed")
    .lt("scheduled_start", startIso)
    .in("patient_id", patientIds);

  if (priorError) {
    console.error("getPatientRetentionSummary: prior-visit lookup failed", priorError);
    return { newCount: patientIds.length, returningCount: 0 };
  }

  const returningIds = new Set((priorRows ?? []).map((row) => row.patient_id));
  return {
    newCount: patientIds.length - returningIds.size,
    returningCount: returningIds.size,
  };
}

// ---------------------------------------------------------------------------
// Doctors — production (billed) and collections (paid), attributed via the
// exact invoice -> appointment -> doctor_id join sync_doctor_compensation()
// (0014_doctor_compensation.sql) already established. doctorId null means
// "invoice with no linked appointment" — the same out-of-scope gap
// Compensation's own trigger already documents and doesn't treat as an error.
// ---------------------------------------------------------------------------

export interface DoctorAmount {
  doctorId: string | null;
  total: number;
}

interface InvoiceDoctorRow {
  total: number;
  appointments: { doctor_id: string } | null;
}

/** Billed amount (invoices.total) by doctor, in range — "Doctor production." */
export async function getDoctorProduction(range: ReportDateRange): Promise<DoctorAmount[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("invoices")
    .select("total, appointments(doctor_id)")
    .is("deleted_at", null)
    .gte("issued_date", range.start)
    .lte("issued_date", range.end);

  if (error) {
    console.error("getDoctorProduction failed", error);
    return [];
  }

  const totals = new Map<string | null, number>();
  for (const row of (data ?? []) as unknown as InvoiceDoctorRow[]) {
    const doctorId = row.appointments?.doctor_id ?? null;
    totals.set(doctorId, (totals.get(doctorId) ?? 0) + Number(row.total));
  }
  return Array.from(totals.entries()).map(([doctorId, total]) => ({ doctorId, total }));
}

/** Collected amount (payments.amount) by doctor, in range — "Doctor collections." Payments only carry invoice_id, so doctor attribution goes through a second, bounded lookup of just the invoices those payments reference — never every invoice in the clinic's history. */
export async function getDoctorCollections(range: ReportDateRange): Promise<DoctorAmount[]> {
  const supabase = await createClient();
  const { startIso, endIsoExclusive } = rangeToTimestampBounds(range);

  const { data: paymentRows, error: paymentError } = await supabase
    .from("payments")
    .select("amount, invoice_id")
    .is("deleted_at", null)
    .gte("paid_at", startIso)
    .lt("paid_at", endIsoExclusive);

  if (paymentError) {
    console.error("getDoctorCollections failed", paymentError);
    return [];
  }
  if (!paymentRows || paymentRows.length === 0) return [];

  const invoiceIds = Array.from(new Set(paymentRows.map((row) => row.invoice_id)));
  const { data: invoiceRows, error: invoiceError } = await supabase
    .from("invoices")
    .select("id, appointments(doctor_id)")
    .in("id", invoiceIds);

  if (invoiceError) {
    console.error("getDoctorCollections: invoice lookup failed", invoiceError);
    return [];
  }

  const doctorByInvoiceId = new Map<string, string | null>();
  for (const row of (invoiceRows ?? []) as unknown as { id: string; appointments: { doctor_id: string } | null }[]) {
    doctorByInvoiceId.set(row.id, row.appointments?.doctor_id ?? null);
  }

  const totals = new Map<string | null, number>();
  for (const row of paymentRows) {
    const doctorId = doctorByInvoiceId.get(row.invoice_id) ?? null;
    totals.set(doctorId, (totals.get(doctorId) ?? 0) + Number(row.amount));
  }
  return Array.from(totals.entries()).map(([doctorId, total]) => ({ doctorId, total }));
}

// ---------------------------------------------------------------------------
// Procedures — the same invoice -> appointment join as Doctors, grouped by
// visit_type_id instead of doctor_id. invoice_items has no procedure link
// (it's free-text line descriptions — see the approved architecture
// review), so appointments.visit_type_id is the only structured attribution
// available, same limitation Doctor production/collections already accept.
// ---------------------------------------------------------------------------

export interface ProcedureAmount {
  visitTypeId: string | null;
  revenue: number;
  appointmentCount: number;
}

export async function getProcedureRevenue(range: ReportDateRange): Promise<ProcedureAmount[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("invoices")
    .select("total, appointments(visit_type_id)")
    .is("deleted_at", null)
    .gte("issued_date", range.start)
    .lte("issued_date", range.end);

  if (error) {
    console.error("getProcedureRevenue failed", error);
    return [];
  }

  const rows = (data ?? []) as unknown as { total: number; appointments: { visit_type_id: string } | null }[];
  const totals = new Map<string | null, { revenue: number; appointmentCount: number }>();
  for (const row of rows) {
    const visitTypeId = row.appointments?.visit_type_id ?? null;
    const existing = totals.get(visitTypeId) ?? { revenue: 0, appointmentCount: 0 };
    existing.revenue += Number(row.total);
    existing.appointmentCount += 1;
    totals.set(visitTypeId, existing);
  }
  return Array.from(totals.entries()).map(([visitTypeId, v]) => ({ visitTypeId, ...v }));
}

export interface PaymentMethodAmount {
  method: string;
  total: number;
  count: number;
}

export async function getPaymentMethodDistribution(range: ReportDateRange): Promise<PaymentMethodAmount[]> {
  const supabase = await createClient();
  const { startIso, endIsoExclusive } = rangeToTimestampBounds(range);

  const { data, error } = await supabase
    .from("payments")
    .select("amount, method")
    .is("deleted_at", null)
    .gte("paid_at", startIso)
    .lt("paid_at", endIsoExclusive);

  if (error) {
    console.error("getPaymentMethodDistribution failed", error);
    return [];
  }

  const totals = new Map<string, { total: number; count: number }>();
  for (const row of data ?? []) {
    const existing = totals.get(row.method) ?? { total: 0, count: 0 };
    existing.total += Number(row.amount);
    existing.count += 1;
    totals.set(row.method, existing);
  }
  return Array.from(totals.entries()).map(([method, v]) => ({ method, ...v }));
}

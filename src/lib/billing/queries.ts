import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Invoice, InvoiceItem, InvoiceStatus, Payment } from "@/types/domain";

export interface InvoiceListRow {
  id: string;
  invoice_number: string;
  status: InvoiceStatus;
  total: number;
  paid_amount: number;
  balance_due: number;
  issued_date: string;
  patient_id: string;
  patient_name: string;
  patient_number: string;
}

interface InvoiceListQueryRow {
  id: string;
  invoice_number: string;
  status: InvoiceStatus;
  total: number;
  paid_amount: number;
  balance_due: number;
  issued_date: string;
  patient_id: string;
  patients: { full_name: string; patient_number: string } | null;
}

export interface InvoiceSearchParams {
  status?: InvoiceStatus;
  /** Matched against invoice_number, e.g. "INV-000042" or a partial. */
  query?: string;
  patientId?: string;
  page?: number;
  pageSize?: number;
}

export interface InvoiceSearchResult {
  rows: InvoiceListRow[];
  totalCount: number;
  page: number;
  pageSize: number;
}

/** Paginated invoice list for the Invoice List page and the Billing Dashboard's "recent invoices". */
export async function searchInvoices(params: InvoiceSearchParams = {}): Promise<InvoiceSearchResult> {
  const supabase = await createClient();
  const page = Math.max(params.page ?? 1, 1);
  const pageSize = params.pageSize ?? 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("invoices")
    .select(
      "id, invoice_number, status, total, paid_amount, balance_due, issued_date, patient_id, patients ( full_name, patient_number )",
      { count: "exact" },
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (params.status) query = query.eq("status", params.status);
  if (params.patientId) query = query.eq("patient_id", params.patientId);
  if (params.query) query = query.ilike("invoice_number", `%${params.query}%`);

  const { data, error, count } = await query.range(from, to);

  if (error) {
    console.error("searchInvoices failed", error);
    return { rows: [], totalCount: 0, page, pageSize };
  }

  const rows = ((data ?? []) as unknown as InvoiceListQueryRow[]).map((row) => ({
    id: row.id,
    invoice_number: row.invoice_number,
    status: row.status,
    total: row.total,
    paid_amount: row.paid_amount,
    balance_due: row.balance_due,
    issued_date: row.issued_date,
    patient_id: row.patient_id,
    patient_name: row.patients?.full_name ?? "—",
    patient_number: row.patients?.patient_number ?? "",
  }));

  return { rows, totalCount: count ?? 0, page, pageSize };
}

export interface InvoiceDetail extends Invoice {
  patient_name: string;
  patient_number: string;
  appointment_scheduled_start: string | null;
  items: InvoiceItem[];
  payments: Payment[];
}

interface InvoiceDetailQueryRow extends Invoice {
  patients: { full_name: string; patient_number: string } | null;
  appointments: { scheduled_start: string } | null;
}

/** Full invoice detail — the invoice row, its patient/appointment display info, items, and non-voided payment history. */
export async function getInvoiceDetail(id: string): Promise<InvoiceDetail | null> {
  const supabase = await createClient();

  const [invoiceRes, itemsRes, paymentsRes] = await Promise.all([
    supabase
      .from("invoices")
      .select("*, patients ( full_name, patient_number ), appointments ( scheduled_start )")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase.from("invoice_items").select("*").eq("invoice_id", id).order("created_at", { ascending: true }),
    supabase
      .from("payments")
      .select("*")
      .eq("invoice_id", id)
      .is("deleted_at", null)
      .order("paid_at", { ascending: false }),
  ]);

  if (invoiceRes.error || !invoiceRes.data) {
    if (invoiceRes.error) console.error("getInvoiceDetail failed", invoiceRes.error);
    return null;
  }

  const { patients, appointments, ...invoice } = invoiceRes.data as unknown as InvoiceDetailQueryRow;

  return {
    ...invoice,
    patient_name: patients?.full_name ?? "—",
    patient_number: patients?.patient_number ?? "",
    appointment_scheduled_start: appointments?.scheduled_start ?? null,
    items: itemsRes.data ?? [],
    payments: paymentsRes.data ?? [],
  };
}

export interface BillingDashboardCounts {
  /** Sum of balance_due across every unpaid/partially_paid invoice. */
  outstandingTotal: number;
  /** Sum of non-voided payment amounts recorded since the start of this calendar month. */
  paidThisMonth: number;
  unpaidCount: number;
  draftCount: number;
}

/** Billing Dashboard stat cards — one round trip per card, run in parallel. */
export async function getBillingDashboardCounts(): Promise<BillingDashboardCounts> {
  const supabase = await createClient();
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [outstandingRes, paidRes, unpaidCountRes, draftCountRes] = await Promise.all([
    supabase.from("invoices").select("balance_due").is("deleted_at", null).in("status", ["unpaid", "partially_paid"]),
    supabase.from("payments").select("amount").is("deleted_at", null).gte("paid_at", monthStart.toISOString()),
    supabase.from("invoices").select("*", { count: "exact", head: true }).is("deleted_at", null).eq("status", "unpaid"),
    supabase.from("invoices").select("*", { count: "exact", head: true }).is("deleted_at", null).eq("status", "draft"),
  ]);

  const outstandingTotal = (outstandingRes.data ?? []).reduce((sum, row) => sum + Number(row.balance_due), 0);
  const paidThisMonth = (paidRes.data ?? []).reduce((sum, row) => sum + Number(row.amount), 0);

  return {
    outstandingTotal,
    paidThisMonth,
    unpaidCount: unpaidCountRes.count ?? 0,
    draftCount: draftCountRes.count ?? 0,
  };
}

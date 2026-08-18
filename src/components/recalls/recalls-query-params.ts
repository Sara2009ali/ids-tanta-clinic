// Plain utility, deliberately kept out of any "use client" file — mirrors
// invoices-query-params.ts exactly, called from both the Server Component
// page and the client filter/pagination components. No "overdue" param:
// overdue is derived from status + due_date at render time (see
// lib/recalls/calculations.ts), never a filterable stored value in v1.
export interface RecallsQueryParams {
  status?: string;
  doctor?: string;
  query?: string;
  page?: string;
}

export function buildRecallsHref(base: RecallsQueryParams, updates: RecallsQueryParams) {
  const merged: RecallsQueryParams = { ...base, ...updates };
  const params = new URLSearchParams();
  for (const key of Object.keys(merged) as (keyof RecallsQueryParams)[]) {
    const value = merged[key];
    if (value) params.set(key, value);
  }
  const qs = params.toString();
  return qs ? `/recalls?${qs}` : "/recalls";
}

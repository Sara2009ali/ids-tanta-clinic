// Plain utility, deliberately kept out of any "use client" file — mirrors
// patients-query-params.ts exactly, called from both the Server Component
// page and the client filter/pagination components.
export interface InvoicesQueryParams {
  status?: string;
  query?: string;
  page?: string;
}

export function buildInvoicesHref(base: InvoicesQueryParams, updates: InvoicesQueryParams) {
  const merged: InvoicesQueryParams = { ...base, ...updates };
  const params = new URLSearchParams();
  for (const key of Object.keys(merged) as (keyof InvoicesQueryParams)[]) {
    const value = merged[key];
    if (value) params.set(key, value);
  }
  const qs = params.toString();
  return qs ? `/billing/invoices?${qs}` : "/billing/invoices";
}

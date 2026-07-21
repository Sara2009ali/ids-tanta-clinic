// Plain utility, deliberately kept out of any "use client" file — mirrors
// compensation-rules-query-params.ts/unresolved-compensation-query-params.ts
// exactly, called from both the Server Component page and the client filter.
export interface ReportsRangeParams {
  from?: string;
  to?: string;
}

export function buildReportsRangeHref(basePath: string, base: ReportsRangeParams, updates: ReportsRangeParams) {
  const merged: ReportsRangeParams = { ...base, ...updates };
  const params = new URLSearchParams();
  if (merged.from) params.set("from", merged.from);
  if (merged.to) params.set("to", merged.to);
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

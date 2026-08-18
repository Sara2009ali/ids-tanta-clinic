// Plain utility, deliberately kept out of any "use client" file — mirrors
// compensation-rules-query-params.ts/unresolved-compensation-query-params.ts
// exactly, called from both the Server Component page and the client filter.
export interface ReportsRangeParams {
  from?: string;
  to?: string;
  /** Optional doctor scope — only the three Advanced Clinical Reports pages set this; every existing report page leaves it undefined and is unaffected. */
  doctor?: string;
}

export function buildReportsRangeHref(basePath: string, base: ReportsRangeParams, updates: ReportsRangeParams) {
  const merged: ReportsRangeParams = { ...base, ...updates };
  const params = new URLSearchParams();
  if (merged.from) params.set("from", merged.from);
  if (merged.to) params.set("to", merged.to);
  if (merged.doctor) params.set("doctor", merged.doctor);
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

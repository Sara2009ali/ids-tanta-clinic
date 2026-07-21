// Plain utility, deliberately kept out of any "use client" file — mirrors
// compensation-rules-query-params.ts exactly, called from both the Server
// Component page and the client filters component.
export interface VisitTypesQueryParams {
  query?: string;
  status?: "active" | "inactive";
}

export function buildVisitTypesHref(base: VisitTypesQueryParams, updates: VisitTypesQueryParams) {
  const merged: VisitTypesQueryParams = { ...base, ...updates };
  const params = new URLSearchParams();
  if (merged.query) params.set("query", merged.query);
  if (merged.status) params.set("status", merged.status);
  const qs = params.toString();
  return qs ? `/appointments/visit-types?${qs}` : "/appointments/visit-types";
}

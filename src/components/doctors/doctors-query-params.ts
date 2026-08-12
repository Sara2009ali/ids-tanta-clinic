// Plain utility, deliberately kept out of any "use client" file — mirrors
// visit-types-query-params.ts exactly, called from both the Server
// Component page and the client filters component.
export interface DoctorsQueryParams {
  query?: string;
  status?: "active" | "inactive";
}

export function buildDoctorsHref(base: DoctorsQueryParams, updates: DoctorsQueryParams) {
  const merged: DoctorsQueryParams = { ...base, ...updates };
  const params = new URLSearchParams();
  if (merged.query) params.set("query", merged.query);
  if (merged.status) params.set("status", merged.status);
  const qs = params.toString();
  return qs ? `/settings/doctors?${qs}` : "/settings/doctors";
}

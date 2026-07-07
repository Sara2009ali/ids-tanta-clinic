// Plain utility, deliberately kept out of any "use client" file — it's
// called from both Server Components (patients/page.tsx, patients-table.tsx)
// and Client Components (patients-filters.tsx, patients-pagination.tsx), and
// a client module's exports can't be called directly from server code.
export interface PatientsQueryParams {
  query?: string;
  gender?: string;
  status?: string;
  doctorId?: string;
  sortBy?: string;
  sortDir?: string;
  page?: string;
}

export function buildPatientsHref(base: PatientsQueryParams, updates: PatientsQueryParams) {
  const merged: PatientsQueryParams = { ...base, ...updates };
  const params = new URLSearchParams();
  for (const key of Object.keys(merged) as (keyof PatientsQueryParams)[]) {
    const value = merged[key];
    if (value) params.set(key, value);
  }
  const qs = params.toString();
  return qs ? `/patients?${qs}` : "/patients";
}

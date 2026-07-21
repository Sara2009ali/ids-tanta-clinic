// Plain utility, deliberately kept out of any "use client" file — mirrors
// invoices-query-params.ts exactly, called from both the Server Component
// page and the client filters component.
export interface CompensationRulesQueryParams {
  query?: string;
  /** "clinic-wide" = only doctor_id-null rules; a doctor's id = only that doctor's rules; omitted = no filter. */
  doctorId?: string;
  /** "all-procedures" = only visit_type_id-null rules; a visit type's id = only that procedure; omitted = no filter. */
  visitTypeId?: string;
  type?: string;
}

export const DOCTOR_FILTER_CLINIC_WIDE = "clinic-wide";
export const VISIT_TYPE_FILTER_ALL_PROCEDURES = "all-procedures";

export function buildCompensationRulesHref(
  base: CompensationRulesQueryParams,
  updates: CompensationRulesQueryParams,
) {
  const merged: CompensationRulesQueryParams = { ...base, ...updates };
  const params = new URLSearchParams();
  for (const key of Object.keys(merged) as (keyof CompensationRulesQueryParams)[]) {
    const value = merged[key];
    if (value) params.set(key, value);
  }
  const qs = params.toString();
  return qs ? `/compensation/rules?${qs}` : "/compensation/rules";
}

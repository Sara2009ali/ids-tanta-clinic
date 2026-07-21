// Plain utility, deliberately kept out of any "use client" file — mirrors
// compensation-rules-query-params.ts exactly, called from both the Server
// Component page and the client filters component.
export interface UnresolvedCompensationQueryParams {
  doctorId?: string;
}

export function buildUnresolvedCompensationHref(
  base: UnresolvedCompensationQueryParams,
  updates: UnresolvedCompensationQueryParams,
) {
  const merged: UnresolvedCompensationQueryParams = { ...base, ...updates };
  const params = new URLSearchParams();
  for (const key of Object.keys(merged) as (keyof UnresolvedCompensationQueryParams)[]) {
    const value = merged[key];
    if (value) params.set(key, value);
  }
  const qs = params.toString();
  return qs ? `/compensation/unresolved?${qs}` : "/compensation/unresolved";
}

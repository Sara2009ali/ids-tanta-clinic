// Plain utility, deliberately kept out of any "use client" file — mirrors
// visit-types-query-params.ts exactly.
export interface ProductsQueryParams {
  query?: string;
  categoryId?: string;
  status?: "active" | "inactive";
  lowStock?: "1";
}

export function buildProductsHref(base: ProductsQueryParams, updates: ProductsQueryParams) {
  const merged: ProductsQueryParams = { ...base, ...updates };
  const params = new URLSearchParams();
  if (merged.query) params.set("query", merged.query);
  if (merged.categoryId) params.set("categoryId", merged.categoryId);
  if (merged.status) params.set("status", merged.status);
  if (merged.lowStock) params.set("lowStock", merged.lowStock);
  const qs = params.toString();
  return qs ? `/inventory/products?${qs}` : "/inventory/products";
}

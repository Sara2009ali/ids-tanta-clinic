/**
 * The one place a service price gets resolved for a given pricing context —
 * reused by Billing, Treatment Plans, and anywhere else a procedure's price
 * needs to be looked up, so there's exactly one resolution path (per the
 * approved Price List design) instead of one per feature.
 *
 * Deliberately pure and synchronous: callers fetch `basePrice` (from
 * visit_types.price) and `overrides` (from price_list_items, for the
 * selected non-default Price List only) however fits their context — an RSC
 * query, a server action, a client-side fetch — and this function never
 * talks to Supabase itself.
 */

export interface ResolveServicePriceInput {
  visitTypeId: string;
  /** visit_types.price — the clinic's single "Normal" price for this service. */
  basePrice: number;
  /** The pricing context to resolve against. null/undefined means "use the clinic default". */
  priceListId?: string | null;
  /** The clinic's default ("Normal") Price List id, if known — resolving against it is always just `basePrice`. */
  defaultPriceListId?: string | null;
  /**
   * price_list_items rows for the *selected* Price List, keyed by
   * visit_type_id. Only ever consulted when priceListId is a non-default
   * list; a missing entry falls back to basePrice rather than erroring —
   * a new Price List starts identical to Normal until a clinic overrides
   * specific services.
   */
  overrides?: ReadonlyMap<string, number>;
}

/** Resolves the price a service should charge under the given pricing context. */
export function resolveServicePrice({
  basePrice,
  priceListId,
  defaultPriceListId,
  overrides,
  visitTypeId,
}: ResolveServicePriceInput): number {
  if (!priceListId || priceListId === defaultPriceListId) {
    return basePrice;
  }
  return overrides?.get(visitTypeId) ?? basePrice;
}

/** Builds the visit_type_id -> price lookup resolveServicePrice() expects, from a list of price_list_items rows. */
export function buildPriceOverrideMap(items: { visit_type_id: string; price: number }[]): Map<string, number> {
  return new Map(items.map((item) => [item.visit_type_id, Number(item.price)]));
}

/**
 * Corrects a pre-seeded invoice line's unit_price to the patient's actually
 * resolved price, once that resolution becomes available — the fix for
 * callers that seed a catalog-linked line (e.g. "Create Invoice" from an
 * appointment row, using the visit type's raw catalog price) before the
 * invoice form has had a chance to resolve the patient's Price List.
 *
 * Only ever corrects a line still sitting at the exact unresolved catalog
 * price — the same "is this still the catalog default" comparison
 * InvoiceItemRow's own "reset to catalog price" button already uses — so it
 * never overwrites a price a user has since edited, nor a line a caller
 * already resolved correctly (e.g. Treatment Plan's Create Invoice, which
 * resolves server-side before seeding). Never touches a custom/no-catalog
 * line (visitTypeId is null).
 */
export function reconcileSeededItemPrice(
  item: { visit_type_id: string | null; unit_price: number },
  rawPrice: number | undefined,
  resolvedPrice: number | undefined,
): number {
  if (!item.visit_type_id || rawPrice == null || resolvedPrice == null) return item.unit_price;
  if (Number(item.unit_price) !== Number(rawPrice)) return item.unit_price;
  return resolvedPrice;
}

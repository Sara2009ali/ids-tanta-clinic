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

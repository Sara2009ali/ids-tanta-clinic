import { describe, it, expect } from "vitest";
import { buildPriceOverrideMap, resolveServicePrice } from "@/lib/pricing/resolve";

describe("resolveServicePrice — the one price resolution path", () => {
  it("uses the base price when no Price List is selected", () => {
    const price = resolveServicePrice({
      visitTypeId: "vt-1",
      basePrice: 500,
      priceListId: null,
      defaultPriceListId: "pl-default",
      overrides: new Map([["vt-1", 350]]),
    });
    expect(price).toBe(500);
  });

  it("uses the base price when the selected list IS the clinic default — resolving against 'Normal' never reads price_list_items", () => {
    const price = resolveServicePrice({
      visitTypeId: "vt-1",
      basePrice: 500,
      priceListId: "pl-default",
      defaultPriceListId: "pl-default",
      overrides: new Map([["vt-1", 999]]),
    });
    expect(price).toBe(500);
  });

  it("uses the Price List's override when one exists for this service", () => {
    const price = resolveServicePrice({
      visitTypeId: "vt-1",
      basePrice: 500,
      priceListId: "pl-insurance-a",
      defaultPriceListId: "pl-default",
      overrides: new Map([["vt-1", 350]]),
    });
    expect(price).toBe(350);
  });

  it("falls back to the base price when the selected non-default list has no override for this service (missing price behavior)", () => {
    const price = resolveServicePrice({
      visitTypeId: "vt-1",
      basePrice: 500,
      priceListId: "pl-insurance-a",
      defaultPriceListId: "pl-default",
      overrides: new Map([["vt-2", 350]]),
    });
    expect(price).toBe(500);
  });

  it("falls back to the base price when overrides weren't provided at all", () => {
    const price = resolveServicePrice({
      visitTypeId: "vt-1",
      basePrice: 500,
      priceListId: "pl-insurance-a",
      defaultPriceListId: "pl-default",
    });
    expect(price).toBe(500);
  });

  it("treats a missing defaultPriceListId as 'never matches' rather than throwing", () => {
    const price = resolveServicePrice({
      visitTypeId: "vt-1",
      basePrice: 500,
      priceListId: "pl-insurance-a",
      defaultPriceListId: null,
      overrides: new Map([["vt-1", 350]]),
    });
    expect(price).toBe(350);
  });
});

describe("buildPriceOverrideMap — price_list_items rows -> lookup", () => {
  it("keys the map by visit_type_id and coerces numeric-string prices", () => {
    const map = buildPriceOverrideMap([
      { visit_type_id: "vt-1", price: 350 },
      { visit_type_id: "vt-2", price: "125.50" as unknown as number },
    ]);
    expect(map.get("vt-1")).toBe(350);
    expect(map.get("vt-2")).toBe(125.5);
  });

  it("returns an empty map for no items", () => {
    expect(buildPriceOverrideMap([]).size).toBe(0);
  });
});

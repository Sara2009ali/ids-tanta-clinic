import { describe, it, expect } from "vitest";
import { buildPriceOverrideMap, reconcileSeededItemPrice, resolveServicePrice } from "@/lib/pricing/resolve";

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

describe("reconcileSeededItemPrice — fixes a pre-seeded line to the patient's resolved price", () => {
  it("corrects a line still sitting at the raw catalog price once resolution differs", () => {
    const item = { visit_type_id: "vt-1", unit_price: 500 };
    expect(reconcileSeededItemPrice(item, 500, 350)).toBe(350);
  });

  it("leaves a line alone when the user (or an already-correct caller) has since changed its price", () => {
    const item = { visit_type_id: "vt-1", unit_price: 425 };
    expect(reconcileSeededItemPrice(item, 500, 350)).toBe(425);
  });

  it("is a no-op when the resolved price equals the raw catalog price (default Price List)", () => {
    const item = { visit_type_id: "vt-1", unit_price: 500 };
    expect(reconcileSeededItemPrice(item, 500, 500)).toBe(500);
  });

  it("never touches a custom line with no catalog link", () => {
    const item = { visit_type_id: null, unit_price: 200 };
    expect(reconcileSeededItemPrice(item, 500, 350)).toBe(200);
  });

  it("leaves the price alone when either the raw or resolved price is unknown", () => {
    const item = { visit_type_id: "vt-1", unit_price: 500 };
    expect(reconcileSeededItemPrice(item, undefined, 350)).toBe(500);
    expect(reconcileSeededItemPrice(item, 500, undefined)).toBe(500);
  });
});

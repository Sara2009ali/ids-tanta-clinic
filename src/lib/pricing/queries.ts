import "server-only";

import { createClient } from "@/lib/supabase/server";
import { buildPriceOverrideMap } from "@/lib/pricing/resolve";
import type { PriceList } from "@/types/domain";

export interface PriceListForManagement extends PriceList {
  item_count: number;
}

/** Every Price List in the clinic, default first, for the management page. */
export async function listPriceLists(): Promise<PriceListForManagement[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("price_lists")
    .select("*, price_list_items(count)")
    .order("is_default", { ascending: false })
    .order("name");

  if (error) {
    console.error("listPriceLists failed", error);
    return [];
  }

  return (data ?? []).map((row) => {
    const { price_list_items, ...priceList } = row as PriceList & {
      price_list_items: { count: number }[];
    };
    return { ...priceList, item_count: price_list_items[0]?.count ?? 0 };
  });
}

/** The clinic's single default ("Normal") Price List id, or null if the seed migration hasn't run yet. */
export async function getDefaultPriceListId(): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("price_lists").select("id").eq("is_default", true).maybeSingle();
  return data?.id ?? null;
}

export interface PriceListDetail {
  priceList: PriceList;
  overrides: Map<string, number>;
}

/** One Price List plus its overrides, keyed by visit_type_id, for the item editor. */
export async function getPriceListDetail(priceListId: string): Promise<PriceListDetail | null> {
  const supabase = await createClient();
  const [priceListRes, itemsRes] = await Promise.all([
    supabase.from("price_lists").select("*").eq("id", priceListId).maybeSingle(),
    supabase.from("price_list_items").select("visit_type_id, price").eq("price_list_id", priceListId),
  ]);

  if (!priceListRes.data) return null;

  return {
    priceList: priceListRes.data,
    overrides: buildPriceOverrideMap(
      (itemsRes.data ?? []).map((item) => ({ visit_type_id: item.visit_type_id, price: Number(item.price) })),
    ),
  };
}

export interface PatientPriceContext {
  priceListId: string | null;
  priceListName: string | null;
  defaultPriceListId: string | null;
  /** Empty when the patient uses the default list, or has no override for any service yet. */
  overrides: Map<string, number>;
}

/**
 * Resolves the pricing context a patient's services should be priced
 * against — their assigned Price List (or the clinic default when unset)
 * plus that list's overrides, ready to hand to resolveServicePrice(). The
 * one place Billing and Treatment Plans both go to answer "what Price List
 * is this patient on".
 */
export async function getPatientPriceContext(patientId: string): Promise<PatientPriceContext> {
  const supabase = await createClient();

  const [patientRes, defaultListRes] = await Promise.all([
    supabase.from("patients").select("price_list_id").eq("id", patientId).maybeSingle(),
    supabase.from("price_lists").select("id").eq("is_default", true).maybeSingle(),
  ]);

  const priceListId = patientRes.data?.price_list_id ?? null;
  const defaultPriceListId = defaultListRes.data?.id ?? null;

  if (!priceListId || priceListId === defaultPriceListId) {
    return { priceListId, priceListName: null, defaultPriceListId, overrides: new Map() };
  }

  const [listRes, itemsRes] = await Promise.all([
    supabase.from("price_lists").select("name").eq("id", priceListId).maybeSingle(),
    supabase.from("price_list_items").select("visit_type_id, price").eq("price_list_id", priceListId),
  ]);

  return {
    priceListId,
    priceListName: listRes.data?.name ?? null,
    defaultPriceListId,
    overrides: buildPriceOverrideMap(
      (itemsRes.data ?? []).map((item) => ({ visit_type_id: item.visit_type_id, price: Number(item.price) })),
    ),
  };
}

export interface PriceListOption {
  id: string;
  name: string;
  is_default: boolean;
}

/** Active Price Lists selectable as a patient's pricing context. */
export async function listPriceListOptions(): Promise<PriceListOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("price_lists")
    .select("id, name, is_default")
    .eq("is_active", true)
    .order("is_default", { ascending: false })
    .order("name");

  return data ?? [];
}

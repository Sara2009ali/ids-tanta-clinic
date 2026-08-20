import "server-only";

import { cookies } from "next/headers";
import { en } from "@/lib/i18n/en";
import { ar } from "@/lib/i18n/ar";
import { LOCALE_COOKIE_NAME, isLocale } from "@/lib/i18n/cookie";
import type { Dictionary, Locale } from "@/lib/i18n/types";

const DICTIONARIES: Record<Locale, Dictionary> = { en, ar };

/** Reads the persisted locale cookie for the current request; defaults to "en" when absent/invalid. */
export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const value = store.get(LOCALE_COOKIE_NAME)?.value;
  return isLocale(value) ? value : "en";
}

export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale];
}

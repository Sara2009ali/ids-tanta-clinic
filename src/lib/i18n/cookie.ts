import type { Locale } from "@/lib/i18n/types";

/**
 * Shared by the client (LocaleProvider, document.cookie) and the server
 * (getLocale() via next/headers cookies()) — a cookie rather than
 * localStorage specifically because Server Components (patients/[id]/page.tsx
 * chief among them) need to read the preference at render time to produce
 * correctly-localized HTML on the first response; localStorage is invisible
 * to the server. Still purely a client-set preference, not a database
 * column — no server action, no user-profile field.
 */
export const LOCALE_COOKIE_NAME = "dentra-locale";
export const LOCALE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export function isLocale(value: string | undefined | null): value is Locale {
  return value === "en" || value === "ar";
}

export function directionFor(locale: Locale): "ltr" | "rtl" {
  return locale === "ar" ? "rtl" : "ltr";
}

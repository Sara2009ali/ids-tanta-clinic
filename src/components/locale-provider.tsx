"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { en } from "@/lib/i18n/en";
import { ar } from "@/lib/i18n/ar";
import { LOCALE_COOKIE_NAME, LOCALE_COOKIE_MAX_AGE_SECONDS, directionFor, isLocale } from "@/lib/i18n/cookie";
import type { Dictionary, Locale } from "@/lib/i18n/types";

export type { Locale } from "@/lib/i18n/types";

const DICTIONARIES: Record<Locale, Dictionary> = { en, ar };

function readCookieLocale(): Locale {
  if (typeof document === "undefined") return "en";
  const match = document.cookie.match(/(?:^|; )dentra-locale=([^;]*)/);
  const value = match ? decodeURIComponent(match[1]) : undefined;
  return isLocale(value) ? value : "en";
}

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  dict: Dictionary;
  dir: "ltr" | "rtl";
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

/**
 * Locale is persisted via a cookie (see lib/i18n/cookie.ts), not
 * localStorage, specifically so the initial render here can read the exact
 * same value the server already used to render this page's Server
 * Components (patients/[id]/page.tsx etc. call getLocale() from
 * lib/i18n/server.ts against the same cookie) — first client render matches
 * server output exactly, no hydration mismatch and no flash, unlike the
 * localStorage-based sidebar-collapsed preference this pattern would
 * otherwise mirror.
 *
 * Switching locale updates the cookie and calls router.refresh() so
 * already-rendered Server Component output (tab labels, field labels, etc.)
 * re-fetches in the new language immediately, without a full page reload.
 */
export function LocaleProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [locale, setLocaleState] = useState<Locale>(() => readCookieLocale());

  const setLocale = useCallback(
    (next: Locale) => {
      document.cookie = `${LOCALE_COOKIE_NAME}=${next}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE_SECONDS}; samesite=lax`;
      document.documentElement.lang = next;
      document.documentElement.dir = directionFor(next);
      setLocaleState(next);
      router.refresh();
    },
    [router],
  );

  const dir = directionFor(locale);

  return (
    <LocaleContext.Provider value={{ locale, setLocale, dict: DICTIONARIES[locale], dir }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used within LocaleProvider");
  return ctx;
}

/** Convenience alias for the common case of just reading strings. */
export function useTranslation(): Dictionary {
  return useLocale().dict;
}

"use client";

import { useTheme } from "next-themes";
import { Monitor, Moon, Sun, Languages } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocale } from "@/components/locale-provider";
import type { Locale } from "@/lib/i18n/types";
import type { Dictionary } from "@/lib/i18n/types";

/**
 * Same segmented-toggle-group pattern already used for the Odontogram's
 * dentition switch and the calendar view switcher — a plain radio-style
 * button row, not a new UI primitive, for a 2-3-option choice that doesn't
 * need a dropdown. Theme persists via next-themes (unchanged mechanism);
 * locale persists via the existing cookie-backed LocaleProvider, which
 * itself calls router.refresh() so this page's own Server-Component text
 * updates immediately after switching.
 */
export function PreferencesForm({ section, dict }: { section: "theme" | "locale"; dict: Dictionary }) {
  if (section === "theme") return <ThemeToggle dict={dict} />;
  return <LocaleToggle dict={dict} />;
}

function ThemeToggle({ dict }: { dict: Dictionary }) {
  const { theme, setTheme } = useTheme();
  const options = [
    { value: "light", label: dict.theme.light, icon: Sun },
    { value: "dark", label: dict.theme.dark, icon: Moon },
    { value: "system", label: dict.theme.system, icon: Monitor },
  ] as const;

  return (
    <div className="inline-flex items-center gap-1 rounded-lg border border-border p-1" role="group" aria-label={dict.theme.label}>
      {options.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          onClick={() => setTheme(value)}
          aria-pressed={(theme ?? "system") === value}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
            (theme ?? "system") === value
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Icon className="size-4" />
          {label}
        </button>
      ))}
    </div>
  );
}

function LocaleToggle({ dict }: { dict: Dictionary }) {
  const { locale, setLocale } = useLocale();
  const options: { value: Locale; label: string }[] = [
    { value: "en", label: dict.locale.english },
    { value: "ar", label: dict.locale.arabic },
  ];

  return (
    <div className="inline-flex items-center gap-1 rounded-lg border border-border p-1" role="group" aria-label={dict.locale.label}>
      {options.map(({ value, label }) => (
        <button
          key={value}
          type="button"
          onClick={() => setLocale(value)}
          aria-pressed={locale === value}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
            locale === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Languages className="size-4" />
          {label}
        </button>
      ))}
    </div>
  );
}

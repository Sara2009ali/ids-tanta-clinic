"use client";

import { Languages } from "lucide-react";
import {
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import { useLocale } from "@/components/locale-provider";

/**
 * Sibling to ThemeMenuItems inside UserMenu — same client-island split (the
 * menu itself is a Server Component), same no-mount-guard reasoning: this
 * only renders once the portaled, closed-by-default DropdownMenuContent is
 * opened, by which point LocaleProvider has already applied the persisted
 * locale.
 */
export function LocaleMenuItems() {
  const { locale, setLocale, dict } = useLocale();

  return (
    <>
      <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">{dict.locale.label}</DropdownMenuLabel>
      <DropdownMenuRadioGroup value={locale} onValueChange={(value) => value && setLocale(value as "en" | "ar")}>
        <DropdownMenuRadioItem value="en">
          <Languages /> {dict.locale.english}
        </DropdownMenuRadioItem>
        <DropdownMenuRadioItem value="ar">
          <Languages /> {dict.locale.arabic}
        </DropdownMenuRadioItem>
      </DropdownMenuRadioGroup>
    </>
  );
}

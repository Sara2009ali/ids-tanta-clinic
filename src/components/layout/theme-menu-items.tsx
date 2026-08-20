"use client";

import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import {
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import { useTranslation } from "@/components/locale-provider";

/**
 * Small client island inside UserMenu (a Server Component) — next-themes'
 * useTheme() is client-only, and this is the only interactive piece the
 * menu needs, so it's split out rather than converting the whole menu.
 *
 * No mount-guard needed for hydration safety here: DropdownMenuContent is
 * portaled and closed by default, so this never renders as part of the
 * initial server-rendered HTML — by the time a user opens the menu,
 * next-themes has already read the persisted theme client-side.
 */
export function ThemeMenuItems() {
  const { theme, setTheme } = useTheme();
  const { theme: dict } = useTranslation();

  return (
    <>
      <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">{dict.label}</DropdownMenuLabel>
      <DropdownMenuRadioGroup value={theme ?? "system"} onValueChange={setTheme}>
        <DropdownMenuRadioItem value="light">
          <Sun /> {dict.light}
        </DropdownMenuRadioItem>
        <DropdownMenuRadioItem value="dark">
          <Moon /> {dict.dark}
        </DropdownMenuRadioItem>
        <DropdownMenuRadioItem value="system">
          <Monitor /> {dict.system}
        </DropdownMenuRadioItem>
      </DropdownMenuRadioGroup>
    </>
  );
}

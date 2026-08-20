import Link from "next/link";
import { ChevronDown, LogOut, SlidersHorizontal } from "lucide-react";
import { logout } from "@/lib/auth/actions";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { STAFF_ROLE_LABELS, type StaffRole } from "@/types/domain";
import { initials } from "@/lib/utils";
import { getLocale, getDictionary } from "@/lib/i18n/server";

/**
 * Theme and language each have exactly one control now: Settings →
 * Preferences (see settings/preferences/page.tsx). This menu only links
 * there — it doesn't duplicate the picker UI, so there's one source of
 * truth for "how do I change my language/theme" instead of two menus that
 * both happen to write the same cookie/localStorage key.
 */
export async function UserMenu({ fullName, role }: { fullName: string; role: StaffRole }) {
  const locale = await getLocale();
  const dict = getDictionary(locale).settings;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="group/profile flex items-center gap-2 rounded-full py-1 ps-1 pe-1 outline-none transition-colors hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring sm:rounded-lg sm:pe-2.5">
        <Avatar className="size-8">
          <AvatarFallback className="bg-primary text-xs text-primary-foreground">{initials(fullName)}</AvatarFallback>
        </Avatar>
        <span className="hidden flex-col items-start leading-tight sm:flex">
          <span className="max-w-32 truncate text-sm font-medium">{fullName}</span>
          <span className="text-xs text-muted-foreground">{STAFF_ROLE_LABELS[role]}</span>
        </span>
        <ChevronDown className="hidden size-3.5 shrink-0 text-muted-foreground transition-transform group-aria-expanded/profile:rotate-180 sm:block" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col sm:hidden">
          <span className="font-medium">{fullName}</span>
          <span className="text-xs font-normal text-muted-foreground">
            {STAFF_ROLE_LABELS[role]}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="sm:hidden" />
        <DropdownMenuItem render={<Link href="/settings/preferences" />}>
          <SlidersHorizontal />
          {dict.preferencesMenuItem}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <form action={logout}>
          <DropdownMenuItem render={<button type="submit" className="w-full cursor-pointer" />}>
            <LogOut />
            Log out
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

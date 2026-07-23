import { ChevronDown, LogOut } from "lucide-react";
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
import { ThemeMenuItems } from "@/components/layout/theme-menu-items";
import { STAFF_ROLE_LABELS, type StaffRole } from "@/types/domain";
import { initials } from "@/lib/utils";

export function UserMenu({ fullName, role }: { fullName: string; role: StaffRole }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="group/profile flex items-center gap-2 rounded-full py-1 pr-1 pl-1 outline-none transition-colors hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring sm:rounded-lg sm:pr-2.5">
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
        <ThemeMenuItems />
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

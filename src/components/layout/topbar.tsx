import { Search, Bell } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/layout/user-menu";
import type { StaffRole } from "@/types/domain";

export function Topbar({ fullName, role }: { fullName: string; role: StaffRole }) {
  return (
    <header className="flex h-16 shrink-0 items-center gap-4 border-b border-border px-6">
      <div className="relative w-full max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search patients..." className="pl-9" disabled />
      </div>
      <div className="ml-auto flex items-center gap-2">
        <Button variant="ghost" size="icon" disabled aria-label="Notifications">
          <Bell className="size-4" />
        </Button>
        <UserMenu fullName={fullName} role={role} />
      </div>
    </header>
  );
}

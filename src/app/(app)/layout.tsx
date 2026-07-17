import { requireStaff } from "@/lib/auth/session";
import { getCurrentPermissions } from "@/lib/authz/session";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [staff, permissions] = await Promise.all([requireStaff(), getCurrentPermissions()]);

  return (
    <div className="flex min-h-svh">
      <Sidebar permissions={permissions} role={staff.role} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar fullName={staff.full_name} role={staff.role} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}

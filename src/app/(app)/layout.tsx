import { requireStaff } from "@/lib/auth/session";
import { getCurrentPermissions } from "@/lib/authz/session";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Notification data is fetched independently inside Topbar's own Suspense
  // boundary (see NotificationBellServer) — it only feeds the bell dropdown,
  // so it shouldn't block the page's own content on every navigation.
  const [staff, permissions] = await Promise.all([requireStaff(), getCurrentPermissions()]);

  return (
    <div className="flex min-h-svh">
      <Sidebar permissions={permissions} role={staff.role} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar fullName={staff.full_name} role={staff.role} permissions={permissions} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="mx-auto max-w-[1800px]">{children}</div>
        </main>
      </div>
    </div>
  );
}

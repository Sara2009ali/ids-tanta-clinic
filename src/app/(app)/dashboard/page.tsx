import { Users, UserPlus, CalendarDays, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { daysAgoIso } from "@/lib/utils";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function DashboardPage() {
  const supabase = await createClient();

  const sevenDaysAgo = daysAgoIso(7);

  const [{ count: totalPatients }, { count: newPatients }] = await Promise.all([
    supabase.from("patients").select("*", { count: "exact", head: true }).eq("status", "active"),
    supabase
      .from("patients")
      .select("*", { count: "exact", head: true })
      .gte("created_at", sevenDaysAgo),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Here&apos;s what&apos;s happening at the clinic today.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active Patients" value={totalPatients ?? 0} icon={Users} />
        <StatCard
          label="New Patients"
          value={newPatients ?? 0}
          icon={UserPlus}
          hint="Last 7 days"
        />
        <StatCard
          label="Appointments Today"
          value="—"
          icon={CalendarDays}
          hint="Available once Appointments ships"
          unavailable
        />
        <StatCard
          label="Outstanding Payments"
          value="—"
          icon={Wallet}
          hint="Available once Financial ships"
          unavailable
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Activity will appear here once the audit log has entries to show.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pending Recalls</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              The Recalls module hasn&apos;t been built yet.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BackLink } from "@/components/layout/back-link";
import { ChairsManager } from "@/components/appointments/chairs-manager";
import { requirePermission } from "@/lib/authz/session";
import { PERMISSIONS } from "@/lib/authz/permissions";
import { listChairsForManagement } from "@/lib/appointments/queries";
import { typography } from "@/lib/typography";

export default async function ChairsPage() {
  // Hard-gated (redirects non-admins to /dashboard), same as
  // /appointments/doctor-schedule — this is clinic configuration, not a
  // view every clinic staff member should reach.
  await requirePermission(PERMISSIONS.SETTINGS_MANAGE);

  const chairs = await listChairsForManagement();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <BackLink href="/appointments" ariaLabel="Back to appointments" />
        <div>
          <h1 className={typography.pageTitle}>Chairs</h1>
          <p className="text-sm text-muted-foreground">
            Add, rename, enable/disable, or remove treatment chairs.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All chairs</CardTitle>
        </CardHeader>
        <CardContent>
          <ChairsManager chairs={chairs} />
        </CardContent>
      </Card>
    </div>
  );
}

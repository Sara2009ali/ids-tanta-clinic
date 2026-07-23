import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
        <Button
          variant="outline"
          size="icon"
          render={<Link href="/appointments" aria-label="Back to appointments" />}
        >
          <ArrowLeft className="size-4" />
        </Button>
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

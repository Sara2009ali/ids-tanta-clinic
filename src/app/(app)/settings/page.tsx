import Link from "next/link";
import { Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { requirePermission } from "@/lib/authz/session";
import { PERMISSIONS } from "@/lib/authz/permissions";
import { typography } from "@/lib/typography";

/**
 * Clinic configuration hub — starts with just Doctors (this phase's only
 * built-out section). Chairs/visit-types/doctor-schedule already live
 * under /appointments/* and stay there; relocating them under /settings
 * is a bigger reorganization than this phase calls for, so this page only
 * grows new sections as they're actually built, rather than linking out to
 * pages that already have a home elsewhere.
 */
export default async function SettingsPage() {
  await requirePermission(PERMISSIONS.SETTINGS_MANAGE);

  return (
    <div className="space-y-6">
      <div>
        <h1 className={typography.pageTitle}>Settings</h1>
        <p className="text-sm text-muted-foreground">Clinic configuration.</p>
      </div>

      <Card className="max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="size-4" />
            Doctors
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Add doctors, manage their profiles, and control application access.
          </p>
          <Button size="sm" render={<Link href="/settings/doctors" />}>
            Manage Doctors
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

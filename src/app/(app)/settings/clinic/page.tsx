import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ClinicSettingsForm } from "@/components/clinic/clinic-settings-form";
import { requirePermission } from "@/lib/authz/session";
import { PERMISSIONS } from "@/lib/authz/permissions";
import { getClinicForSettings } from "@/lib/clinic/queries";
import { getLocale, getDictionary } from "@/lib/i18n/server";
import { typography } from "@/lib/typography";

/**
 * Clinic identity + regional settings — the one place an admin edits the
 * clinics row created at sign-up (lib/onboarding/actions.ts). Hard-gated on
 * SETTINGS_MANAGE, same as every other clinic-configuration page
 * (Doctors, Staff, Insurance).
 */
export default async function ClinicSettingsPage() {
  const staff = await requirePermission(PERMISSIONS.SETTINGS_MANAGE);
  const locale = await getLocale();
  const dict = getDictionary(locale).clinic;

  if (!staff.clinic_id) {
    notFound();
  }

  const clinic = await getClinicForSettings(staff.clinic_id);
  if (!clinic) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" render={<Link href="/settings" aria-label="Back to settings" />}>
          <ArrowLeft className="size-4" />
        </Button>
        <div>
          <h1 className={typography.pageTitle}>{dict.pageTitle}</h1>
          <p className="text-sm text-muted-foreground">{dict.pageSubtitle}</p>
        </div>
      </div>

      <Card className="max-w-2xl">
        <CardContent>
          <ClinicSettingsForm clinic={clinic} />
        </CardContent>
      </Card>
    </div>
  );
}

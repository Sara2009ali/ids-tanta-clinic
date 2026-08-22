import Link from "next/link";
import { Users, SlidersHorizontal, Tags, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { requireStaff } from "@/lib/auth/session";
import { getCurrentPermissions } from "@/lib/authz/session";
import { hasPermission, PERMISSIONS } from "@/lib/authz/permissions";
import { getLocale, getDictionary } from "@/lib/i18n/server";
import { typography } from "@/lib/typography";

/**
 * Settings hub — reachable by every signed-in staff member (Preferences is
 * a personal setting, not clinic configuration), with admin-only sections
 * conditionally rendered inside rather than gating the whole page. Doctors
 * remains this phase's only clinic-configuration section; grows as more are
 * built, same as before.
 */
export default async function SettingsPage() {
  await requireStaff();
  const [permissions, locale] = await Promise.all([getCurrentPermissions(), getLocale()]);
  const dict = getDictionary(locale).settings;
  const canManageClinic = hasPermission(permissions, PERMISSIONS.SETTINGS_MANAGE);

  return (
    <div className="space-y-6">
      <div>
        <h1 className={typography.pageTitle}>{dict.title}</h1>
        <p className="text-sm text-muted-foreground">{dict.subtitle}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <SlidersHorizontal className="size-4" />
              {dict.preferencesCardTitle}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">{dict.preferencesCardDescription}</p>
            <Button size="sm" render={<Link href="/settings/preferences" />}>
              {dict.managePreferences}
            </Button>
          </CardContent>
        </Card>

        {canManageClinic && (
          <Card className="max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="size-4" />
                {dict.doctorsCardTitle}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">{dict.doctorsCardDescription}</p>
              <Button size="sm" render={<Link href="/settings/doctors" />}>
                {dict.manageDoctors}
              </Button>
            </CardContent>
          </Card>
        )}

        {canManageClinic && (
          <Card className="max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Tags className="size-4" />
                {dict.priceListsCardTitle}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">{dict.priceListsCardDescription}</p>
              <Button size="sm" render={<Link href="/procedures/price-lists" />}>
                {dict.managePriceLists}
              </Button>
            </CardContent>
          </Card>
        )}

        {canManageClinic && (
          <Card className="max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="size-4" />
                {dict.insuranceCardTitle}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">{dict.insuranceCardDescription}</p>
              <Button size="sm" render={<Link href="/settings/insurance" />}>
                {dict.manageInsurance}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StaffFormSheet } from "@/components/staff/staff-form-sheet";
import { StaffTable } from "@/components/staff/staff-table";
import { requirePermission } from "@/lib/authz/session";
import { PERMISSIONS } from "@/lib/authz/permissions";
import { listStaffForManagement } from "@/lib/staff/queries";
import { getLocale, getDictionary } from "@/lib/i18n/server";
import { typography } from "@/lib/typography";

/**
 * The general staff roster — every staff_profiles row, including doctors,
 * so this reads as "everyone who works here" per the product brief. Adding
 * a doctor still happens from Settings → Doctors (their extra
 * doctor_profiles fields don't fit this form); this page's "Add Staff"
 * covers every other role.
 */
export default async function StaffPage() {
  await requirePermission(PERMISSIONS.SETTINGS_MANAGE);
  const [staff, locale] = await Promise.all([listStaffForManagement(), getLocale()]);
  const dict = getDictionary(locale).staff;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" render={<Link href="/settings" aria-label="Back to settings" />}>
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <h1 className={typography.pageTitle}>{dict.title}</h1>
            <p className="text-sm text-muted-foreground">{dict.subtitle}</p>
          </div>
        </div>
        <StaffFormSheet />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{dict.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <StaffTable staff={staff} />
        </CardContent>
      </Card>
    </div>
  );
}

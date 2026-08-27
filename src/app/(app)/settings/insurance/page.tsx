import { BackLink } from "@/components/layout/back-link";
import { requirePermission } from "@/lib/authz/session";
import { PERMISSIONS } from "@/lib/authz/permissions";
import { listInsurersWithPlans } from "@/lib/insurance/queries";
import { InsuranceManager } from "@/components/insurance/insurance-manager";
import { getLocale, getDictionary } from "@/lib/i18n/server";
import { typography } from "@/lib/typography";

export default async function InsuranceSettingsPage() {
  // Hard-gated, same as /settings/doctors and /procedures/price-lists —
  // insurers/plans are clinic configuration, not a view every clinic staff
  // member should reach.
  await requirePermission(PERMISSIONS.SETTINGS_MANAGE);

  const [insurers, locale] = await Promise.all([listInsurersWithPlans(), getLocale()]);
  const dict = getDictionary(locale).insurance;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <BackLink href="/settings" ariaLabel="Back to settings" />
        <div>
          <h1 className={typography.pageTitle}>{dict.pageTitle}</h1>
          <p className="text-sm text-muted-foreground">{dict.pageDescription}</p>
        </div>
      </div>

      <InsuranceManager insurers={insurers} dict={dict} />
    </div>
  );
}

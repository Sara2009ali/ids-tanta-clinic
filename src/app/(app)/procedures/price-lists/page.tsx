import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PriceListsManager } from "@/components/pricing/price-lists-manager";
import { requirePermission } from "@/lib/authz/session";
import { PERMISSIONS } from "@/lib/authz/permissions";
import { listPriceLists } from "@/lib/pricing/queries";
import { getLocale, getDictionary } from "@/lib/i18n/server";
import { typography } from "@/lib/typography";

export default async function PriceListsPage() {
  await requirePermission(PERMISSIONS.SETTINGS_MANAGE);

  const [priceLists, locale] = await Promise.all([listPriceLists(), getLocale()]);
  const dict = getDictionary(locale).priceLists;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Button size="sm" variant="ghost" className="-ms-2" render={<Link href="/procedures" />}>
          <ArrowLeft className="size-4" />
          {dict.backToProcedures}
        </Button>
        <div>
          <h1 className={typography.pageTitle}>{dict.pageTitle}</h1>
          <p className="text-sm text-muted-foreground">{dict.pageDescription}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{dict.pageTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <PriceListsManager priceLists={priceLists} dict={dict} />
        </CardContent>
      </Card>
    </div>
  );
}

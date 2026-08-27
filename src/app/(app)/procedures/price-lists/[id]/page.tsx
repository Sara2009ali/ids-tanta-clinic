import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BackLink } from "@/components/layout/back-link";
import { Badge } from "@/components/ui/badge";
import { PriceListItemsEditor } from "@/components/pricing/price-list-items-editor";
import { requirePermission } from "@/lib/authz/session";
import { PERMISSIONS } from "@/lib/authz/permissions";
import { getPriceListDetail } from "@/lib/pricing/queries";
import { listVisitTypes } from "@/lib/appointments/queries";
import { getLocale, getDictionary } from "@/lib/i18n/server";
import { typography } from "@/lib/typography";

export default async function PriceListDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission(PERMISSIONS.SETTINGS_MANAGE);

  const { id } = await params;
  const [detail, visitTypes, locale] = await Promise.all([getPriceListDetail(id), listVisitTypes(), getLocale()]);
  const dict = getDictionary(locale).priceLists;

  if (!detail) {
    notFound();
  }

  const { priceList, overrides } = detail;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <BackLink href="/procedures/price-lists" label={dict.detail.backToPriceLists} />
        <div className="flex items-center gap-2">
          <h1 className={typography.pageTitle}>{priceList.name}</h1>
          {priceList.is_default && <Badge variant="secondary">{dict.defaultBadge}</Badge>}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{dict.editPrices}</CardTitle>
        </CardHeader>
        <CardContent>
          {priceList.is_default ? (
            <p className="text-sm text-muted-foreground">{dict.detail.defaultListNotice}</p>
          ) : (
            <PriceListItemsEditor
              priceListId={priceList.id}
              visitTypes={visitTypes}
              overrides={Object.fromEntries(overrides)}
              dict={dict.detail}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

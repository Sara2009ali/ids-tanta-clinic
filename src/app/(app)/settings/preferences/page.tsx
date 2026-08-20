import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PreferencesForm } from "@/components/settings/preferences-form";
import { requireStaff } from "@/lib/auth/session";
import { getLocale, getDictionary } from "@/lib/i18n/server";
import { typography } from "@/lib/typography";

/**
 * A personal preference page, not clinic configuration — requireStaff()
 * only (no permission check), same as the Settings hub it's linked from.
 */
export default async function PreferencesPage() {
  await requireStaff();
  const locale = await getLocale();
  const dict = getDictionary(locale);

  return (
    <div className="space-y-6">
      <div>
        <h1 className={typography.pageTitle}>{dict.settings.preferences.pageTitle}</h1>
        <p className="text-sm text-muted-foreground">{dict.settings.preferences.pageDescription}</p>
      </div>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="text-base">{dict.settings.preferences.themeSectionTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <PreferencesForm section="theme" dict={dict} />
        </CardContent>
      </Card>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="text-base">{dict.settings.preferences.languageSectionTitle}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{dict.settings.preferences.languageSectionDescription}</p>
          <PreferencesForm section="locale" dict={dict} />
        </CardContent>
      </Card>
    </div>
  );
}

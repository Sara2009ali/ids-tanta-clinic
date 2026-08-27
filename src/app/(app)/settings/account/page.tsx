import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PasswordChangeForm } from "@/components/settings/password-change-form";
import { requireStaff } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getLocale, getDictionary } from "@/lib/i18n/server";
import { typography } from "@/lib/typography";

/**
 * A personal account page, not clinic configuration — requireStaff() only
 * (no permission check), same as Preferences. Email comes from Supabase
 * Auth (auth.getUser(), the RLS-scoped client's own session) rather than
 * staff_profiles, which has no email column — staff email only ever lives
 * in Supabase Auth, same source listStaffForManagement() reads from via the
 * Admin API for other people's rows.
 */
export default async function AccountPage() {
  const staff = await requireStaff();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const dict = getDictionary(await getLocale());

  return (
    <div className="space-y-6">
      <div>
        <h1 className={typography.pageTitle}>{dict.account.pageTitle}</h1>
        <p className="text-sm text-muted-foreground">{dict.account.pageSubtitle}</p>
      </div>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="text-base">{dict.account.identitySectionTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">{dict.account.nameLabel}</dt>
              <dd>{staff.full_name}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{dict.account.emailLabel}</dt>
              <dd>{user?.email ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{dict.account.roleLabel}</dt>
              <dd>{dict.staff.roles[staff.role]}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="text-base">{dict.account.passwordSectionTitle}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{dict.account.passwordSectionDescription}</p>
          <PasswordChangeForm email={user?.email ?? ""} />
        </CardContent>
      </Card>
    </div>
  );
}

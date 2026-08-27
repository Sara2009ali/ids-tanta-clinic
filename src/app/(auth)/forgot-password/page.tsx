import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { getLocale, getDictionary } from "@/lib/i18n/server";
import { typography } from "@/lib/typography";

export const metadata: Metadata = {
  title: "Reset your password — Dentra",
};

export default async function ForgotPasswordPage() {
  const dict = getDictionary(await getLocale()).auth.forgotPassword;

  return (
    <div className="space-y-8">
      <div className="space-y-1.5">
        <h1 className={typography.pageTitle}>{dict.pageTitle}</h1>
        <p className="text-sm text-muted-foreground">{dict.pageSubtitle}</p>
      </div>
      <ForgotPasswordForm />
    </div>
  );
}

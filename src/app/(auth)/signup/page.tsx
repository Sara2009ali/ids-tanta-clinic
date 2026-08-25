import type { Metadata } from "next";
import { SignUpForm } from "@/components/auth/signup-form";
import { getLocale, getDictionary } from "@/lib/i18n/server";
import { typography } from "@/lib/typography";

export const metadata: Metadata = {
  title: "Create your clinic — Dentra",
};

export default async function SignUpPage() {
  const dict = getDictionary(await getLocale()).onboarding.signup;

  return (
    <div className="space-y-8">
      <div className="space-y-1.5">
        <h1 className={typography.pageTitle}>{dict.pageTitle}</h1>
        <p className="text-sm text-muted-foreground">{dict.pageSubtitle}</p>
      </div>
      <SignUpForm />
    </div>
  );
}

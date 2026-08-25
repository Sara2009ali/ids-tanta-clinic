import type { Metadata } from "next";
import { ActivateForm } from "@/components/auth/activate-form";
import { getLocale, getDictionary } from "@/lib/i18n/server";
import { typography } from "@/lib/typography";

export const metadata: Metadata = {
  title: "Activate your account — Dentra",
};

export default async function ActivatePage() {
  const dict = getDictionary(await getLocale()).onboarding.activate;

  return (
    <div className="space-y-8">
      <div className="space-y-1.5">
        <h1 className={typography.pageTitle}>{dict.pageTitle}</h1>
        <p className="text-sm text-muted-foreground">{dict.pageSubtitle}</p>
      </div>
      <ActivateForm />
    </div>
  );
}

import { ComingSoon } from "@/components/layout/coming-soon";
import { typography } from "@/lib/typography";

export default function SettingsPage() {
  return (
    <div className="flex h-full flex-col gap-6">
      <h1 className={typography.pageTitle}>Settings</h1>
      <ComingSoon module="Settings" />
    </div>
  );
}

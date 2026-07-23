import { ComingSoon } from "@/components/layout/coming-soon";
import { typography } from "@/lib/typography";

export default function RecallsPage() {
  return (
    <div className="flex h-full flex-col gap-6">
      <h1 className={typography.pageTitle}>Recalls</h1>
      <ComingSoon module="Recalls" />
    </div>
  );
}

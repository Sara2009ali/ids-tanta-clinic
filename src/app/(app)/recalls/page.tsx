import { ComingSoon } from "@/components/layout/coming-soon";

export default function RecallsPage() {
  return (
    <div className="flex h-full flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Recalls</h1>
      <ComingSoon module="Recalls" />
    </div>
  );
}

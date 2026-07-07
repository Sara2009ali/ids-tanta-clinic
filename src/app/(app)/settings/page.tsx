import { ComingSoon } from "@/components/layout/coming-soon";

export default function SettingsPage() {
  return (
    <div className="flex h-full flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      <ComingSoon module="Settings" />
    </div>
  );
}

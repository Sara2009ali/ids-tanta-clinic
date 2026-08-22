import { Skeleton } from "@/components/ui/skeleton";

export default function InsuranceSettingsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Skeleton className="size-9 rounded-md" />
        <div className="space-y-2">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-4 w-96" />
        </div>
      </div>

      <div className="space-y-4 rounded-xl border border-border p-6">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-16 w-full sm:w-80" />
      </div>

      <div className="space-y-4 rounded-xl border border-border p-6">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-16 w-full sm:w-80" />
      </div>
    </div>
  );
}

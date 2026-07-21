import { Skeleton } from "@/components/ui/skeleton";

const SKELETON_ROWS = 6;

export default function NotificationsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-8 w-32" />
      </div>

      <Skeleton className="h-8 w-40" />

      <div className="overflow-hidden rounded-xl border border-border">
        <div className="divide-y divide-border">
          {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
            <div key={i} className="flex items-start gap-3 px-4 py-3">
              <Skeleton className="mt-0.5 size-4 shrink-0 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3.5 w-2/3" />
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="h-7 w-20" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

import { Skeleton } from "@/components/ui/skeleton";

/**
 * Mirrors the actual hero + summary rail + tabs + Overview shape (see
 * page.tsx) so the real content doesn't jump the layout when it lands —
 * same avatar size, same rail strip beneath the hero, same section count.
 */
export default function PatientProfileLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-4 w-40" />

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="flex flex-col gap-6 p-6 sm:p-7 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex flex-1 flex-col gap-5 sm:flex-row sm:items-center">
            <Skeleton className="size-20 shrink-0 rounded-full sm:size-24" />
            <div className="space-y-2.5">
              <div className="flex items-center gap-2">
                <Skeleton className="h-7 w-44" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-56" />
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-24" />
          </div>
        </div>
        <div className="grid grid-cols-2 divide-x divide-y divide-border border-t border-border sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-1.5 px-5 py-4">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-5 w-20" />
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-24" />
        ))}
      </div>

      <div className="space-y-5">
        <div className="grid gap-x-6 gap-y-5 rounded-xl border border-border p-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-4 w-32" />
            </div>
          ))}
        </div>
        <div className="grid gap-x-6 gap-y-5 rounded-xl border border-border p-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-4 w-32" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

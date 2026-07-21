"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function CompensationReportError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("CompensationReportPage failed to render", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border py-24 text-center">
      <AlertTriangle className="size-8 text-muted-foreground" />
      <div className="space-y-1">
        <p className="text-sm font-medium">Couldn&apos;t load the compensation report.</p>
        <p className="text-sm text-muted-foreground">Something went wrong. You can try again or go back.</p>
      </div>
      <div className="flex items-center gap-2 pt-2">
        <Button variant="outline" size="sm" render={<Link href="/reports" />}>
          Back to Reports
        </Button>
        <Button size="sm" onClick={reset}>
          Try again
        </Button>
      </div>
    </div>
  );
}

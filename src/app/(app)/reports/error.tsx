"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ReportsHubError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("ReportsHubPage failed to render", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border py-24 text-center">
      <AlertTriangle className="size-8 text-muted-foreground" />
      <div className="space-y-1">
        <p className="text-sm font-medium">Couldn&apos;t load reports.</p>
        <p className="text-sm text-muted-foreground">Something went wrong. You can try again.</p>
      </div>
      <Button size="sm" onClick={reset} className="mt-2">
        Try again
      </Button>
    </div>
  );
}

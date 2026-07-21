"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function BillingError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("BillingDashboardPage failed to render", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border py-24 text-center">
      <AlertTriangle className="size-8 text-muted-foreground" />
      <div className="space-y-1">
        <p className="text-sm font-medium">Couldn&apos;t load billing.</p>
        <p className="text-sm text-muted-foreground">Something went wrong. Please try again.</p>
      </div>
      <Button size="sm" onClick={reset} className="mt-2">
        Try again
      </Button>
    </div>
  );
}

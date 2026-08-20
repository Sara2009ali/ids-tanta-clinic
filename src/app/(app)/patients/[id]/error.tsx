"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/components/locale-provider";

export default function PatientProfileError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { patientProfile: t } = useTranslation();

  useEffect(() => {
    console.error("PatientProfilePage failed to render", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border py-24 text-center">
      <AlertTriangle className="size-8 text-muted-foreground" />
      <div className="space-y-1">
        <p className="text-sm font-medium">{t.errorState.title}</p>
        <p className="text-sm text-muted-foreground">{t.errorState.description}</p>
      </div>
      <div className="flex items-center gap-2 pt-2">
        <Button variant="outline" size="sm" render={<Link href="/patients" />}>
          {t.errorState.backToPatients}
        </Button>
        <Button size="sm" onClick={reset}>
          {t.errorState.tryAgain}
        </Button>
      </div>
    </div>
  );
}

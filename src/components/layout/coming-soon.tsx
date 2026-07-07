import { Construction } from "lucide-react";

export function ComingSoon({ module }: { module: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border py-24 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted">
        <Construction className="size-5 text-muted-foreground" />
      </div>
      <div>
        <p className="font-medium">{module} is coming in a later phase</p>
        <p className="text-sm text-muted-foreground">
          This module hasn&apos;t been built yet — check back once it&apos;s scheduled.
        </p>
      </div>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Loader2, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateTreatmentPlanTitle } from "@/lib/treatment-plans/actions";
import { typography } from "@/lib/typography";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/**
 * Click-to-edit plan title — title stays optional at creation time (see
 * NewTreatmentPlanButton, which skips asking for one entirely), so this is
 * the only place it's ever set. Falls back to a formatted creation date,
 * same "Treatment Plan · <date>" convention the list uses, so an unnamed
 * plan never reads as broken or unfinished.
 */
export function TreatmentPlanTitle({
  planId,
  title,
  createdAt,
  canEdit,
}: {
  planId: string;
  title: string | null;
  createdAt: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(title ?? "");
  const [pending, startTransition] = useTransition();

  const displayTitle = title || `Treatment Plan · ${formatDate(createdAt)}`;

  function handleSave() {
    const formData = new FormData();
    formData.set("title", value);
    startTransition(async () => {
      const result = await updateTreatmentPlanTitle(planId, formData);
      if (result.error) {
        toast.error(result.error);
      } else {
        setEditing(false);
        router.refresh();
      }
    });
  }

  function handleCancel() {
    setValue(title ?? "");
    setEditing(false);
  }

  if (!canEdit) {
    return <h1 className={typography.pageTitle}>{displayTitle}</h1>;
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1.5">
        <Input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") handleCancel();
          }}
          placeholder="e.g. Restorative & Periodontal Plan"
          aria-label="Treatment plan title"
          className="font-heading h-auto max-w-xs py-1 text-xl font-medium sm:text-2xl"
          disabled={pending}
        />
        <Button size="icon-sm" disabled={pending} onClick={handleSave} aria-label="Save title">
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
        </Button>
        <Button size="icon-sm" variant="ghost" disabled={pending} onClick={handleCancel} aria-label="Cancel">
          <X className="size-4" />
        </Button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="group flex items-center gap-2 rounded-md text-left focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      aria-label="Edit treatment plan title"
    >
      <h1 className={typography.pageTitle}>{displayTitle}</h1>
      <Pencil className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
    </button>
  );
}

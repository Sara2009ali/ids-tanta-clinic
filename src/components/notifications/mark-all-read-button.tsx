"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { markAllNotificationsRead } from "@/lib/notifications/actions";

/**
 * Shared by the dropdown header and the full page header — one action, one
 * implementation. Calls onSuccess for the caller to update its own local
 * state optimistically instead of a full router.refresh() — this is a
 * single-column status flip across a handful of rows, not something that
 * needs a full-tree server re-render.
 */
export function MarkAllReadButton({ size = "sm", onSuccess }: { size?: "sm" | "default"; onSuccess?: () => void }) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await markAllNotificationsRead();
      if (result.error) {
        toast.error(result.error);
      } else {
        onSuccess?.();
      }
    });
  }

  return (
    <Button variant="ghost" size={size} disabled={pending} onClick={handleClick}>
      {pending && <Loader2 className="size-3.5 animate-spin" />}
      Mark all as read
    </Button>
  );
}

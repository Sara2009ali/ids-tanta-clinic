import { AlertTriangle, CheckCircle2, Info, Settings2, type LucideIcon } from "lucide-react";
import type { NotificationType } from "@/types/domain";

/**
 * Icon + color per severity. warning/success use the dedicated
 * `--warning-text`/`--success-text` tokens (globals.css) — legible-on-neutral
 * text pairs alongside the `--warning`/`--success` badge-background tints,
 * rather than each call site hand-picking a raw amber/emerald shade.
 * `critical` uses `text-destructive` directly since that token is already
 * full-strength/foreground-usable.
 */
export const NOTIFICATION_TYPE_META: Record<NotificationType, { icon: LucideIcon; className: string }> = {
  info: { icon: Info, className: "text-muted-foreground" },
  success: { icon: CheckCircle2, className: "text-success-text" },
  warning: { icon: AlertTriangle, className: "text-warning-text" },
  critical: { icon: AlertTriangle, className: "text-destructive" },
  system: { icon: Settings2, className: "text-muted-foreground" },
};

/** Relative-time display for a notification's timestamp — minute/hour granularity, unlike unresolved-compensation-table.tsx's day-granularity formatAge(), since "5m ago" vs "Today" matters a lot more for a live notification feed than for a backlog-age stat. */
export function formatNotificationTime(iso: string): string {
  const date = new Date(iso);
  const diffMinutes = Math.floor((Date.now() - date.getTime()) / 60000);

  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}

import type { CSSProperties } from "react";

/**
 * Shared Recharts styling — the "chart language" every chart in the app
 * speaks, so a new chart looks like it belongs to Dentra by construction
 * instead of each one re-deriving axis/tooltip styling from scratch. All
 * colors reference the same CSS custom properties as the rest of the UI,
 * so charts stay in sync with the active theme automatically.
 */

export const chartAxisTick = { fill: "var(--muted-foreground)", fontSize: 12 } as const;

export const chartTooltipContentStyle: CSSProperties = {
  background: "var(--popover)",
  color: "var(--popover-foreground)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-md)",
  boxShadow: "var(--elevation-high)",
  fontSize: 13,
  padding: "8px 12px",
};

export const chartTooltipLabelStyle: CSSProperties = {
  color: "var(--muted-foreground)",
  fontSize: 12,
  marginBottom: 2,
};

export const chartTooltipItemStyle: CSSProperties = { padding: 0 };

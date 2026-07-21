/**
 * Small, shared typography scale — plain class-string constants rather than
 * a wrapper component, matching this codebase's existing preference for
 * direct Tailwind utility classes over abstraction layers. Before this,
 * heading/body sizing was ad hoc per component (e.g. "text-2xl
 * font-semibold" repeated with slight drift across every page header).
 * Import and spread/compose with cn() alongside any per-usage overrides.
 */
export const typography = {
  /** Top-level page heading, e.g. "Patients", "Billing". */
  pageTitle: "text-2xl font-semibold tracking-tight",
  /** Section heading within a page, above a card group or table. */
  sectionTitle: "text-base font-medium",
  /** Small uppercase label grouping a cluster of stat cards or a page section — e.g. "Today", "Overview". */
  eyebrow: "text-xs font-medium tracking-wide text-muted-foreground uppercase",
  /** Card/Dialog/Sheet title — matches ui/card.tsx's CardTitle sizing. */
  cardTitle: "text-base font-medium leading-snug",
  /** Standard body copy. */
  body: "text-sm",
  /** Secondary/supporting text under a title. */
  subtitle: "text-sm text-muted-foreground",
  /** Small metadata/caption text (timestamps, counts). */
  caption: "text-xs text-muted-foreground",
  /** Large tabular numbers, e.g. stat card values. */
  statValue: "text-2xl font-semibold tabular-nums",
} as const;

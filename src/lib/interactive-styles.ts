/**
 * Shared class-string constants for the "interactive surface" motion pattern
 * used across the app (Today's Schedule rows, Recent Invoices, compensation
 * and inventory quick lists, report category cards): a resting card with a
 * low shadow that lifts and gains a higher shadow on hover. Kept as plain
 * strings — composed with cn() alongside layout-specific classes — matching
 * this codebase's existing typography.ts convention over a wrapper component.
 */

/** Drop onto an element already styled like ui/card.tsx's <Card> (rounded-xl, ring, bg-card, shadow-elevation-low) to make the whole card lift on hover. */
export const cardHoverLift =
  "transition-[background-color,box-shadow,transform] duration-150 hover:-translate-y-0.5 hover:bg-muted/40 hover:shadow-elevation-high";

/** Full surface + hover treatment for a clickable row that isn't rendered through the <Card> component (e.g. a <Link> wrapping a list item). */
export const interactiveRowCard =
  "flex items-center gap-3 rounded-xl bg-card p-3 ring-1 ring-foreground/10 shadow-elevation-low transition-[background-color,box-shadow,transform] duration-150 hover:-translate-y-0.5 hover:bg-muted/50 hover:shadow-elevation-high";

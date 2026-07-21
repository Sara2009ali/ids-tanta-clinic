/**
 * Small set of hand-drawn, inline SVG illustrations for the highest-traffic
 * empty states (first-run screens) — line-art only, no photography/stock
 * icons, so they stay lightweight, theme-aware (currentColor + one accent),
 * and consistent with the brand's minimal/premium direction. Used sparingly
 * — only where a genuine "first thing you see" moment benefits from more
 * than a plain icon (see EmptyState's `illustration` prop).
 */

type IllustrationProps = { className?: string };

/** Patients: a small cluster of people. */
export function PeopleIllustration({ className }: IllustrationProps) {
  return (
    <svg viewBox="0 0 120 88" fill="none" className={className} aria-hidden="true">
      <circle cx="60" cy="30" r="16" className="stroke-border" strokeWidth="1.5" />
      <path
        d="M32 78c0-15.464 12.536-28 28-28s28 12.536 28 28"
        className="stroke-border"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="22" cy="40" r="11" className="stroke-muted-foreground/40" strokeWidth="1.5" />
      <path
        d="M2 80c0-11.046 8.954-20 20-20s20 8.954 20 20"
        className="stroke-muted-foreground/40"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="98" cy="40" r="11" className="stroke-muted-foreground/40" strokeWidth="1.5" />
      <path
        d="M78 80c0-11.046 8.954-20 20-20s20 8.954 20 20"
        className="stroke-muted-foreground/40"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="60" cy="30" r="4" className="fill-primary" />
    </svg>
  );
}

/** Invoices/records: a small stack of document cards. */
export function DocumentsIllustration({ className }: IllustrationProps) {
  return (
    <svg viewBox="0 0 120 88" fill="none" className={className} aria-hidden="true">
      <rect x="14" y="16" width="68" height="56" rx="6" className="stroke-muted-foreground/40" strokeWidth="1.5" />
      <rect x="30" y="8" width="68" height="56" rx="6" className="fill-card stroke-border" strokeWidth="1.5" />
      <line x1="42" y1="24" x2="86" y2="24" className="stroke-muted-foreground/40" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="42" y1="34" x2="78" y2="34" className="stroke-muted-foreground/40" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="42" y1="44" x2="70" y2="44" className="stroke-muted-foreground/40" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="90" cy="58" r="12" className="fill-background stroke-gold" strokeWidth="1.5" />
      <path d="M85 58l3.5 3.5L96 53" className="stroke-gold" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Inventory/products: two overlapping stock boxes. */
export function BoxesIllustration({ className }: IllustrationProps) {
  return (
    <svg viewBox="0 0 120 88" fill="none" className={className} aria-hidden="true">
      <rect x="10" y="34" width="52" height="42" rx="6" className="stroke-muted-foreground/40" strokeWidth="1.5" />
      <line x1="10" y1="50" x2="62" y2="50" className="stroke-muted-foreground/40" strokeWidth="1.5" />
      <line x1="36" y1="34" x2="36" y2="50" className="stroke-muted-foreground/40" strokeWidth="1.5" />
      <rect x="52" y="14" width="58" height="46" rx="6" className="fill-card stroke-border" strokeWidth="1.5" />
      <line x1="52" y1="32" x2="110" y2="32" className="stroke-border" strokeWidth="1.5" />
      <line x1="81" y1="14" x2="81" y2="32" className="stroke-border" strokeWidth="1.5" />
      <circle cx="81" cy="23" r="3" className="fill-primary" />
    </svg>
  );
}

export const EMPTY_STATE_ILLUSTRATIONS = {
  people: PeopleIllustration,
  documents: DocumentsIllustration,
  boxes: BoxesIllustration,
} as const;

export type EmptyStateIllustrationName = keyof typeof EMPTY_STATE_ILLUSTRATIONS;

/**
 * Pure dental-chart logic — no I/O, deliberately kept out of queries.ts/
 * actions.ts (which have `import "server-only"` for their real Supabase
 * calls). Mirrors the exact treatment-plans/calculations.ts split already
 * established in this codebase, for the same reason: the decision logic is
 * testable against hand-built fixtures even though this repo has no local
 * Postgres test harness to exercise the real queries/RLS against.
 */

import type { ToothArch, ToothDentition } from "@/types/domain";

/**
 * Every valid FDI (ISO 3950) code for both dentitions — the same set seeded
 * into public.teeth by 0029_dental_chart.sql. Permanent: quadrants 1-4,
 * positions 1-8 (32 teeth). Primary: quadrants 5-8, positions 1-5 only (20
 * teeth — central incisor through second molar; no premolars/third molar).
 * Kept as a single source of truth so validation, seeding, and any future
 * "list every tooth" UI never drift from each other.
 */
export const PERMANENT_FDI_NUMBERS: readonly number[] = Array.from({ length: 4 }, (_, q) => q + 1).flatMap(
  (quadrant) => Array.from({ length: 8 }, (_, p) => quadrant * 10 + p + 1),
);

export const PRIMARY_FDI_NUMBERS: readonly number[] = Array.from({ length: 4 }, (_, q) => q + 5).flatMap(
  (quadrant) => Array.from({ length: 5 }, (_, p) => quadrant * 10 + p + 1),
);

export const ALL_FDI_NUMBERS: readonly number[] = [...PERMANENT_FDI_NUMBERS, ...PRIMARY_FDI_NUMBERS];

const VALID_FDI_NUMBERS = new Set(ALL_FDI_NUMBERS);

/** Whether `fdi` is one of the 52 real FDI codes — not just "a two-digit number in range." */
export function isValidFdiNumber(fdi: number): boolean {
  return VALID_FDI_NUMBERS.has(fdi);
}

/** Derived from the number alone, same rule as teeth.dentition's generated column — never trust a caller-supplied dentition value that could disagree with the number. */
export function dentitionForFdiNumber(fdi: number): ToothDentition {
  const quadrant = Math.floor(fdi / 10);
  return quadrant >= 1 && quadrant <= 4 ? "permanent" : "primary";
}

/** Derived from the number alone, same rule as teeth.arch's generated column. */
export function archForFdiNumber(fdi: number): ToothArch {
  const quadrant = Math.floor(fdi / 10);
  return quadrant === 1 || quadrant === 2 || quadrant === 5 || quadrant === 6 ? "upper" : "lower";
}

const UNIVERSAL_BY_FDI: Readonly<Record<number, string>> = Object.fromEntries(
  [
    [18, 1], [17, 2], [16, 3], [15, 4], [14, 5], [13, 6], [12, 7], [11, 8],
    [21, 9], [22, 10], [23, 11], [24, 12], [25, 13], [26, 14], [27, 15], [28, 16],
    [38, 17], [37, 18], [36, 19], [35, 20], [34, 21], [33, 22], [32, 23], [31, 24],
    [41, 25], [42, 26], [43, 27], [44, 28], [45, 29], [46, 30], [47, 31], [48, 32],
  ].map(([fdi, universal]) => [fdi, String(universal)]),
);

// Primary dentition has no standard numeric Universal mapping — it uses
// letters A-T (upper right to lower right, same traversal order as the
// permanent 1-32 sequence above).
const PRIMARY_UNIVERSAL_LETTERS = "ABCDEFGHIJKLMNOPQRST";
const UNIVERSAL_LETTER_BY_FDI: Readonly<Record<number, string>> = Object.fromEntries(
  [55, 54, 53, 52, 51, 61, 62, 63, 64, 65, 75, 74, 73, 72, 71, 81, 82, 83, 84, 85].map((fdi, index) => [
    fdi,
    PRIMARY_UNIVERSAL_LETTERS[index],
  ]),
);

/**
 * Display-only conversion, computed on render, never stored (per the
 * approved architecture — FDI is the sole canonical stored numbering
 * system). Returns null for an invalid code rather than guessing.
 */
export function fdiToUniversal(fdi: number): string | null {
  if (!isValidFdiNumber(fdi)) return null;
  return UNIVERSAL_BY_FDI[fdi] ?? UNIVERSAL_LETTER_BY_FDI[fdi] ?? null;
}

// True Palmer notation draws a right-angle bracket around the number,
// oriented to the quadrant — not reliably representable as a single
// plain-text glyph across fonts. A quadrant abbreviation prefix (UR/UL/LL/LR)
// is used instead: unambiguous in any font, and still immediately readable
// as "which quadrant, which position" the way Palmer is meant to convey.
const PALMER_QUADRANT_ABBREVIATION: Readonly<Record<number, string>> = {
  1: "UR",
  2: "UL",
  3: "LL",
  4: "LR",
  5: "UR",
  6: "UL",
  7: "LL",
  8: "LR",
};

/**
 * Display-only conversion, computed on render, never stored. Palmer notation
 * is a quadrant plus the position within it (1-8 permanent, 1-5 primary use
 * letters A-E by the same upper-right-first convention as Universal).
 * Returns null for an invalid code.
 */
export function fdiToPalmer(fdi: number): string | null {
  if (!isValidFdiNumber(fdi)) return null;
  const quadrant = Math.floor(fdi / 10);
  const position = fdi % 10;
  const abbreviation = PALMER_QUADRANT_ABBREVIATION[quadrant];
  const dentition = dentitionForFdiNumber(fdi);
  const label = dentition === "primary" ? "ABCDE"[position - 1] : String(position);
  return abbreviation && label ? `${abbreviation}${label}` : null;
}

export interface ToothStateInput {
  status: string;
  condition: string | null;
}

/**
 * A tooth "needs attention" for the chart's summary stat ("3 teeth need
 * attention") when its condition is anything other than healthy/absent —
 * caries and watch are the two values that represent something unresolved;
 * filling/crown/root_canal are completed restorations, not open concerns.
 * Missing teeth are their own visual state on the odontogram, not counted
 * here — "needs attention" is about active clinical concerns, not absence.
 */
export function toothNeedsAttention(tooth: ToothStateInput): boolean {
  return tooth.condition === "caries" || tooth.condition === "watch";
}

export interface AppointmentPatientRow {
  patient_id: string;
}

/** Same defense-in-depth shape as isAppointmentForPatient() in treatment-plans/calculations.ts — split out so the comparison is unit-testable independent of the Supabase lookup that fetches `appointment`. */
export function isAppointmentForPatient(appointment: AppointmentPatientRow | null, patientId: string): boolean {
  return appointment?.patient_id === patientId;
}

export interface SoftDeletableTreatmentPlanItem {
  status: string;
}

/** A plan item renders as a "planned" marker on the chart only once the patient/clinic has actually committed to it — matches the same accepted/in_progress set the Treatment Plan progress bar already treats as "moving forward" (computeItemProgress in treatment-plans/calculations.ts), not the full item lifecycle. */
export function isPlannedOnChart(item: SoftDeletableTreatmentPlanItem): boolean {
  return item.status === "accepted" || item.status === "in_progress";
}

/**
 * Labels this module needs to describe a tooth's state or history in
 * whatever language the caller is rendering in — kept out of this file
 * entirely (no hardcoded English, no import of the i18n dictionaries) so
 * these stay pure, dependency-free functions; the Dental Chart components
 * pass in the current locale's strings.
 */
export interface ToothLabels {
  status: Record<string, string>;
  condition: Record<string, string>;
  /** "Present, no conditions recorded" (or equivalent) — shown when a tooth has no condition and no other note-worthy state. */
  presentNoCondition: string;
}

/** The Tooth Sheet's "Current state" summary and the odontogram button's accessible name both boil down to this same present→condition-or-healthy resolution — the single source of truth for "what does this tooth's state mean in words." */
export function toothStateLabel(status: string, condition: string | null, labels: ToothLabels): string {
  if (status !== "present") return labels.status[status] ?? status;
  return condition ? (labels.condition[condition] ?? condition) : labels.presentNoCondition;
}

export interface ToothEventInput {
  event_type: string;
  notes: string | null;
  previous_status: string | null;
  previous_condition: string | null;
  status: string | null;
  condition: string | null;
}

export interface ToothEventLabels extends ToothLabels {
  /** Shown for an observation event with no notes text (shouldn't normally happen — notes is required on create — but an older/edge-case row could still lack one). */
  observationFallback: string;
  /** Short fallback for a null previous/new condition in the from→to diagram — deliberately shorter than ToothLabels.presentNoCondition, which reads better as a full sentence elsewhere. */
  healthy: string;
  /** Neither the status nor the condition actually changed (a notes-only edit doesn't reach this — see applyToothStateChange's `changed` gate — but a from===to condition pair can still occur when only notes changed alongside an unrelated event). */
  stateUpdated: string;
  /** Template containing the literal substring "{status}", replaced with the localized status name — e.g. "Marked {status}" / "تم تحديد الحالة: {status}". */
  markedStatusTemplate: string;
  /** Placed between the previous and new condition label — direction-aware per locale (e.g. " → " for LTR, " ← " for RTL) rather than relying on bidi text to reposition a fixed glyph correctly. */
  conditionChangeConnector: string;
}

/**
 * One line describing a patient_tooth_events row for the Tooth Sheet's
 * history list — mirrors applyToothStateChange's event-writing rules
 * exactly: "observation" rows carry their own notes; "state_changed" rows
 * either flipped status (missing/unerupted/present) or changed condition
 * (or, in principle, both, in which case the status change takes priority
 * since it's the more significant fact).
 */
export function describeToothEvent(event: ToothEventInput, labels: ToothEventLabels): string {
  if (event.event_type === "observation") {
    return event.notes ?? labels.observationFallback;
  }

  const from = event.previous_condition ? (labels.condition[event.previous_condition] ?? event.previous_condition) : labels.healthy;
  const to = event.condition ? (labels.condition[event.condition] ?? event.condition) : labels.healthy;
  const statusChanged = event.previous_status !== event.status;

  if (statusChanged && event.status) {
    const statusLabel = labels.status[event.status] ?? event.status;
    return labels.markedStatusTemplate.replace("{status}", statusLabel);
  }

  return from === to ? labels.stateUpdated : `${from}${labels.conditionChangeConnector}${to}`;
}

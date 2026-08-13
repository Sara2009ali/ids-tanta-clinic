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

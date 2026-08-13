import { z } from "zod";
import { isValidFdiNumber } from "@/lib/dental-chart/calculations";

const trimmedOptional = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined));

/** Shared by every "" (unset) / omitted (undefined) -> null preprocess below — a blank form field and a field that was never sent mean the same thing: nothing was chosen. */
function blankToNull(value: unknown): unknown {
  return value === undefined || value === null || (typeof value === "string" && value.trim() === "") ? null : value;
}

/** Every write that names a specific tooth validates against the real 52-code FDI set (isValidFdiNumber), not just "a two-digit number" — a syntactically plausible but nonexistent code (e.g. 19, 59) is rejected here rather than reaching the database's FK constraint. */
export const fdiNumberSchema = z.coerce
  .number()
  .int()
  .refine(isValidFdiNumber, { message: "Not a valid tooth number" });

/**
 * Optional structured-tooth companion field, shared by treatment-plans and
 * treatments schemas (0029_dental_chart.sql §F/§G) — "" or an omitted key
 * both mean "no specific tooth", not a validation error.
 */
export const nullableFdiNumberSchema = z.preprocess(blankToNull, fdiNumberSchema.nullable());

export const toothStatusSchema = z.enum(["present", "missing", "unerupted"]);

export const toothConditionSchema = z.enum(["caries", "filling", "crown", "root_canal", "watch", "other"]);

/** "" (the form's "no condition" option) or an omitted key both become null — a healthy tooth, not an unset/unknown one — never an arbitrary string. */
const nullableToothCondition = z.preprocess(blankToNull, toothConditionSchema.nullable());

export const toothEventTypeSchema = z.enum(["observation", "state_changed"]);

/**
 * Used by both the "mark missing/unerupted" quick action and the "add/edit
 * condition" Dialog — same fields either way, since both are really "set the
 * tooth's current state." status defaults to "present" so a form that only
 * changes condition doesn't have to resend it.
 */
export const toothStateFormSchema = z.object({
  status: toothStatusSchema.default("present"),
  condition: nullableToothCondition.default(null),
  notes: trimmedOptional,
});

export type ToothStateFormValues = z.infer<typeof toothStateFormSchema>;

/** A plain clinical observation — doesn't itself change patient_tooth_state, per the approved event model (event_type: "observation"). appointment_id is optional and, when present, is verified server-side to belong to the same patient, same defense-in-depth as treatment-plans/clinical-notes. */
export const toothObservationFormSchema = z.object({
  notes: z.string().trim().min(1, "Enter what you observed"),
  appointment_id: trimmedOptional,
});

export type ToothObservationFormValues = z.infer<typeof toothObservationFormSchema>;

function str(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === "string" ? value : undefined;
}

export function toothStateFormValuesFromFormData(formData: FormData) {
  return {
    status: str(formData, "status") ?? "present",
    condition: str(formData, "condition") ?? "",
    notes: str(formData, "notes"),
  };
}

export function toothObservationFormValuesFromFormData(formData: FormData) {
  return {
    notes: str(formData, "notes") ?? "",
    appointment_id: str(formData, "appointment_id"),
  };
}

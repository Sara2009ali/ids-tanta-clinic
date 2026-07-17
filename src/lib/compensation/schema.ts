import { z } from "zod";

const trimmedOptional = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined));

/**
 * One flat schema, not a discriminated union — config fields are optional
 * at the schema level and required conditionally per `type` in
 * `superRefine`, since FormData arrives as flat string fields (no dynamic
 * array the way invoice items has, so there's nothing to JSON-encode into
 * a hidden field the way InvoiceFormSheet does).
 */
export const compensationRuleFormSchema = z
  .object({
    doctor_id: trimmedOptional,
    visit_type_id: trimmedOptional,
    type: z.enum(["percentage", "fixed", "hybrid"]),
    rate: z.coerce.number().min(0, "Rate can't be negative").max(100, "Rate can't exceed 100%").optional(),
    amount: z.coerce.number().min(0, "Amount can't be negative").optional(),
    base_amount: z.coerce.number().min(0, "Base amount can't be negative").optional(),
    effective_from: trimmedOptional,
  })
  .superRefine((values, ctx) => {
    if (values.type === "percentage" && values.rate === undefined) {
      ctx.addIssue({ code: "custom", path: ["rate"], message: "Enter a percentage rate" });
    }
    if (values.type === "fixed" && values.amount === undefined) {
      ctx.addIssue({ code: "custom", path: ["amount"], message: "Enter a fixed amount" });
    }
    if (values.type === "hybrid" && values.rate === undefined && values.base_amount === undefined) {
      ctx.addIssue({ code: "custom", path: ["rate"], message: "Enter a base amount and/or a rate" });
    }
  });

export type CompensationRuleFormValues = z.infer<typeof compensationRuleFormSchema>;

function str(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === "string" ? value : undefined;
}

export function compensationRuleFormValuesFromFormData(formData: FormData) {
  return {
    doctor_id: str(formData, "doctor_id"),
    visit_type_id: str(formData, "visit_type_id"),
    type: str(formData, "type") ?? "percentage",
    rate: str(formData, "rate"),
    amount: str(formData, "amount"),
    base_amount: str(formData, "base_amount"),
    effective_from: str(formData, "effective_from"),
  };
}

export const closeCompensationRuleFormSchema = z.object({
  effective_to: trimmedOptional,
});

export function closeCompensationRuleFormValuesFromFormData(formData: FormData) {
  return { effective_to: str(formData, "effective_to") };
}

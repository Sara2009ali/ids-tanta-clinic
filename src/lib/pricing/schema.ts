import { z } from "zod";

export const priceListFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Enter a Price List name")
    .max(50, "Keep it under 50 characters"),
});

export type PriceListFormValues = z.infer<typeof priceListFormSchema>;

// null clears the override (reverts the service to the base/Normal price) —
// distinct from 0, a genuine free/zero-price override. Matches how
// visitTypeFormSchema treats "" as "not set" for optional catalog fields.
export const priceListItemFormSchema = z.object({
  price: z
    .string()
    .trim()
    .transform((value) => (value.length > 0 ? value : null))
    .refine((value) => value === null || (!Number.isNaN(Number(value)) && Number(value) >= 0), {
      message: "Price can't be negative",
    })
    .transform((value) => (value === null ? null : Number(value))),
});

export type PriceListItemFormValues = z.infer<typeof priceListItemFormSchema>;

function str(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === "string" ? value : undefined;
}

export function priceListFormValuesFromFormData(formData: FormData) {
  return { name: str(formData, "name") ?? "" };
}

export function priceListItemFormValuesFromFormData(formData: FormData) {
  return { price: str(formData, "price") ?? "" };
}

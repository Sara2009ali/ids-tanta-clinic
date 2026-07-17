import { describe, it, expect } from "vitest";
import {
  invoiceFormSchema,
  invoiceFormValuesFromFormData,
  invoiceItemInputSchema,
  paymentFormSchema,
  paymentFormValuesFromFormData,
} from "@/lib/billing/schema";

describe("invoiceItemInputSchema", () => {
  const validItem = { description: "Cleaning", quantity: 1, unit_price: 200, discount_amount: 0 };

  it("parses a valid item", () => {
    const result = invoiceItemInputSchema.safeParse(validItem);
    expect(result.success).toBe(true);
  });

  it("defaults discount_amount to 0 when omitted", () => {
    const { discount_amount, ...rest } = validItem;
    void discount_amount;
    const result = invoiceItemInputSchema.safeParse(rest);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.discount_amount).toBe(0);
  });

  it("fails on an empty description", () => {
    const result = invoiceItemInputSchema.safeParse({ ...validItem, description: "" });
    expect(result.success).toBe(false);
  });

  it("fails when quantity is zero or negative", () => {
    expect(invoiceItemInputSchema.safeParse({ ...validItem, quantity: 0 }).success).toBe(false);
    expect(invoiceItemInputSchema.safeParse({ ...validItem, quantity: -1 }).success).toBe(false);
  });

  it("fails when unit_price is negative", () => {
    expect(invoiceItemInputSchema.safeParse({ ...validItem, unit_price: -1 }).success).toBe(false);
  });

  it("fails when discount_amount is negative", () => {
    expect(invoiceItemInputSchema.safeParse({ ...validItem, discount_amount: -1 }).success).toBe(false);
  });

  it("coerces numeric strings, as FormData/JSON round-tripping would provide", () => {
    const result = invoiceItemInputSchema.safeParse({ ...validItem, quantity: "2", unit_price: "150" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.quantity).toBe(2);
      expect(result.data.unit_price).toBe(150);
    }
  });
});

describe("invoiceFormSchema", () => {
  const validInput = {
    patient_id: "patient-1",
    appointment_id: "appointment-1",
    tax_percent: 14,
    notes: "Payment plan discussed",
    items: [{ description: "Cleaning", quantity: 1, unit_price: 200, discount_amount: 0 }],
  };

  it("parses a valid full input", () => {
    const result = invoiceFormSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it("fails when patient_id is empty", () => {
    const result = invoiceFormSchema.safeParse({ ...validInput, patient_id: "" });
    expect(result.success).toBe(false);
  });

  it("passes when appointment_id is omitted (manual invoice)", () => {
    const { appointment_id, ...rest } = validInput;
    void appointment_id;
    const result = invoiceFormSchema.safeParse(rest);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.appointment_id).toBeUndefined();
  });

  it("defaults tax_percent to 0 when omitted", () => {
    const { tax_percent, ...rest } = validInput;
    void tax_percent;
    const result = invoiceFormSchema.safeParse(rest);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.tax_percent).toBe(0);
  });

  it("fails when tax_percent is negative or exceeds 100", () => {
    expect(invoiceFormSchema.safeParse({ ...validInput, tax_percent: -1 }).success).toBe(false);
    expect(invoiceFormSchema.safeParse({ ...validInput, tax_percent: 101 }).success).toBe(false);
  });

  it("fails when items is empty", () => {
    const result = invoiceFormSchema.safeParse({ ...validInput, items: [] });
    expect(result.success).toBe(false);
  });

  it("fails when any item is invalid", () => {
    const result = invoiceFormSchema.safeParse({
      ...validInput,
      items: [{ description: "", quantity: 1, unit_price: 200, discount_amount: 0 }],
    });
    expect(result.success).toBe(false);
  });

  it("accepts multiple items", () => {
    const result = invoiceFormSchema.safeParse({
      ...validInput,
      items: [
        { description: "Cleaning", quantity: 1, unit_price: 200, discount_amount: 0 },
        { description: "X-ray", quantity: 2, unit_price: 50, discount_amount: 10 },
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.items).toHaveLength(2);
  });
});

describe("invoiceFormValuesFromFormData", () => {
  it("parses the JSON-encoded items field and every other field", () => {
    const formData = new FormData();
    formData.set("patient_id", "patient-1");
    formData.set("appointment_id", "appointment-1");
    formData.set("tax_percent", "14");
    formData.set("notes", "Payment plan discussed");
    formData.set("items", JSON.stringify([{ description: "Cleaning", quantity: 1, unit_price: 200 }]));

    const values = invoiceFormValuesFromFormData(formData);
    expect(values.patient_id).toBe("patient-1");
    expect(values.appointment_id).toBe("appointment-1");
    expect(values.tax_percent).toBe("14");
    expect(values.notes).toBe("Payment plan discussed");
    expect(values.items).toEqual([{ description: "Cleaning", quantity: 1, unit_price: 200 }]);

    const result = invoiceFormSchema.safeParse(values);
    expect(result.success).toBe(true);
  });

  it("falls back to an empty items array on malformed JSON instead of throwing", () => {
    const formData = new FormData();
    formData.set("patient_id", "patient-1");
    formData.set("items", "{not valid json");

    const values = invoiceFormValuesFromFormData(formData);
    expect(values.items).toEqual([]);
  });

  it("defaults missing fields to empty/undefined", () => {
    const formData = new FormData();
    const values = invoiceFormValuesFromFormData(formData);
    expect(values.patient_id).toBe("");
    expect(values.appointment_id).toBeUndefined();
    expect(values.tax_percent).toBe("0");
    expect(values.notes).toBeUndefined();
    expect(values.items).toEqual([]);
  });
});

describe("paymentFormSchema", () => {
  const validInput = { amount: 100, method: "cash", reference: "REF-1", notes: "Paid at front desk" };

  it("parses a valid payment", () => {
    expect(paymentFormSchema.safeParse(validInput).success).toBe(true);
  });

  it("fails when amount is zero or negative", () => {
    expect(paymentFormSchema.safeParse({ ...validInput, amount: 0 }).success).toBe(false);
    expect(paymentFormSchema.safeParse({ ...validInput, amount: -50 }).success).toBe(false);
  });

  it("fails on an invalid method", () => {
    expect(paymentFormSchema.safeParse({ ...validInput, method: "crypto" }).success).toBe(false);
  });

  it.each(["cash", "visa", "bank_transfer", "wallet", "other"])("accepts method %s", (method) => {
    expect(paymentFormSchema.safeParse({ ...validInput, method }).success).toBe(true);
  });

  it("passes when reference and notes are omitted", () => {
    const result = paymentFormSchema.safeParse({ amount: 100, method: "cash" });
    expect(result.success).toBe(true);
  });
});

describe("paymentFormValuesFromFormData", () => {
  it("extracts every field from a populated form", () => {
    const formData = new FormData();
    formData.set("amount", "100");
    formData.set("method", "visa");
    formData.set("reference", "REF-1");
    formData.set("notes", "Paid in full");

    const values = paymentFormValuesFromFormData(formData);
    expect(values).toEqual({ amount: "100", method: "visa", reference: "REF-1", notes: "Paid in full" });
  });

  it("defaults method to cash and leaves reference/notes undefined when missing", () => {
    const formData = new FormData();
    formData.set("amount", "50");
    const values = paymentFormValuesFromFormData(formData);
    expect(values.method).toBe("cash");
    expect(values.reference).toBeUndefined();
    expect(values.notes).toBeUndefined();
  });
});

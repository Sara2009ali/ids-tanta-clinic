import { describe, it, expect } from "vitest";
import { validateNewPassword, MIN_PASSWORD_LENGTH } from "@/lib/settings/password";

describe("validateNewPassword", () => {
  it("accepts a password that meets the minimum length and matches its confirmation", () => {
    expect(validateNewPassword("supersecret", "supersecret")).toEqual({ ok: true });
  });

  it("rejects a password shorter than the minimum length", () => {
    const short = "a".repeat(MIN_PASSWORD_LENGTH - 1);
    expect(validateNewPassword(short, short)).toEqual({ ok: false, reason: "too_short" });
  });

  it("accepts a password exactly at the minimum length", () => {
    const exact = "a".repeat(MIN_PASSWORD_LENGTH);
    expect(validateNewPassword(exact, exact)).toEqual({ ok: true });
  });

  it("rejects mismatched confirmation even when both individually meet the length rule", () => {
    expect(validateNewPassword("supersecret", "supersecret2")).toEqual({ ok: false, reason: "mismatch" });
  });

  it("reports too_short before mismatch when both problems are present", () => {
    expect(validateNewPassword("short", "different")).toEqual({ ok: false, reason: "too_short" });
  });
});

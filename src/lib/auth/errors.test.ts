import { describe, it, expect } from "vitest";
import { isDuplicateAuthError } from "@/lib/auth/errors";

describe("isDuplicateAuthError", () => {
  it("returns false for null/undefined", () => {
    expect(isDuplicateAuthError(null)).toBe(false);
    expect(isDuplicateAuthError(undefined)).toBe(false);
  });

  it("returns true for the email_exists error code", () => {
    expect(isDuplicateAuthError({ code: "email_exists", message: "" })).toBe(true);
  });

  it("returns true when the message mentions the email is already registered", () => {
    expect(isDuplicateAuthError({ message: "A user with this email address has already been registered" })).toBe(true);
  });

  it("returns true when the message says the user already exists", () => {
    expect(isDuplicateAuthError({ message: "User already exists" })).toBe(true);
  });

  it("returns false for an unrelated error", () => {
    expect(isDuplicateAuthError({ code: "weak_password", message: "Password is too weak" })).toBe(false);
  });
});

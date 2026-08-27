import { describe, it, expect } from "vitest";
import { extractBearerToken, isValidSchedulerSecret } from "@/lib/scheduler/auth";

describe("extractBearerToken", () => {
  it("extracts the token from a well-formed Bearer header", () => {
    expect(extractBearerToken("Bearer my-secret-value")).toBe("my-secret-value");
  });

  it("returns null when the header is missing", () => {
    expect(extractBearerToken(null)).toBeNull();
  });

  it("returns null when the header doesn't use the Bearer scheme", () => {
    expect(extractBearerToken("Basic dXNlcjpwYXNz")).toBeNull();
  });

  it("returns null for a bare 'Bearer' with no token", () => {
    expect(extractBearerToken("Bearer ")).toBeNull();
    expect(extractBearerToken("Bearer")).toBeNull();
  });

  it("is case-sensitive on the scheme, matching the HTTP spec's exact casing", () => {
    expect(extractBearerToken("bearer my-secret-value")).toBeNull();
  });
});

describe("isValidSchedulerSecret", () => {
  const SECRET = "a-very-long-random-scheduler-secret-value";

  it("accepts the exact configured secret", () => {
    expect(isValidSchedulerSecret(SECRET, SECRET)).toBe(true);
  });

  it("rejects a completely different secret of the same length", () => {
    const wrong = "b".repeat(SECRET.length);
    expect(isValidSchedulerSecret(wrong, SECRET)).toBe(false);
  });

  it("rejects a secret that differs by only its last character (same length) — proves comparison isn't short-circuiting on a prefix match", () => {
    const almostRight = SECRET.slice(0, -1) + "!";
    expect(isValidSchedulerSecret(almostRight, SECRET)).toBe(false);
  });

  it("rejects a shorter or longer provided value without throwing (timingSafeEqual would throw on length mismatch if not guarded)", () => {
    expect(() => isValidSchedulerSecret(SECRET.slice(0, -1), SECRET)).not.toThrow();
    expect(isValidSchedulerSecret(SECRET.slice(0, -1), SECRET)).toBe(false);
    expect(() => isValidSchedulerSecret(SECRET + "x", SECRET)).not.toThrow();
    expect(isValidSchedulerSecret(SECRET + "x", SECRET)).toBe(false);
  });

  it("rejects a null/missing provided value", () => {
    expect(isValidSchedulerSecret(null, SECRET)).toBe(false);
  });

  it("rejects an empty provided value", () => {
    expect(isValidSchedulerSecret("", SECRET)).toBe(false);
  });

  it("fails closed if the expected secret itself is empty (misconfiguration), never treating that as 'no auth required'", () => {
    expect(isValidSchedulerSecret("anything", "")).toBe(false);
    expect(isValidSchedulerSecret("", "")).toBe(false);
  });
});

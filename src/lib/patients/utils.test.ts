import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { calculateAge, initials, buildPatientFilePath } from "@/lib/patients/utils";

describe("calculateAge", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Fixed "now": July 5, local time, well clear of midnight so
    // timezone conversion of date-only ISO strings can't shift months.
    vi.setSystemTime(new Date(2026, 6, 5, 12, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the correct whole-years age for a clearly past date", () => {
    expect(calculateAge("1990-03-20")).toBe(36);
  });

  it("returns null for missing dates", () => {
    expect(calculateAge(null)).toBeNull();
    expect(calculateAge(undefined)).toBeNull();
  });

  it("returns null for an invalid date string", () => {
    expect(calculateAge("not-a-date")).toBeNull();
  });

  it("returns null for a future date", () => {
    expect(calculateAge("2099-05-05")).toBeNull();
  });

  it("does not count this year's birthday if it hasn't occurred yet (same month, later day)", () => {
    expect(calculateAge("1995-07-20")).toBe(30);
  });

  it("does not count this year's birthday if it hasn't occurred yet (later month)", () => {
    expect(calculateAge("1995-09-10")).toBe(30);
  });

  it("counts this year's birthday once it has already occurred (earlier month)", () => {
    expect(calculateAge("1995-04-10")).toBe(31);
  });

  it("counts this year's birthday once it has already occurred (same month, earlier day)", () => {
    expect(calculateAge("1995-07-03")).toBe(31);
  });
});

describe("initials", () => {
  it("returns two uppercase initials for a two-word name", () => {
    expect(initials("john doe")).toBe("JD");
  });

  it("returns a single initial for a single-word name", () => {
    expect(initials("john")).toBe("J");
  });

  it("handles extra whitespace between words", () => {
    expect(initials("  john    doe  ")).toBe("JD");
  });

  it("only uses the first two words when more than two are given", () => {
    expect(initials("john michael doe")).toBe("JM");
  });
});

describe("buildPatientFilePath", () => {
  it("sanitizes unsafe characters in the file name", () => {
    const path = buildPatientFilePath("clinic-1", "patient-1", "my file (1)!.png");
    const fileNamePart = path.split("/").pop()!;
    const sanitizedName = fileNamePart.replace(/^\d+-/, "");
    expect(sanitizedName).toBe("my_file__1__.png");
    expect(sanitizedName).not.toMatch(/[ ()!]/);
  });

  it("includes the clinicId and patientId in the resulting path", () => {
    const path = buildPatientFilePath("clinic-42", "patient-7", "report.pdf");
    expect(path.startsWith("clinic-42/patient-7/")).toBe(true);
    expect(path).toMatch(/^clinic-42\/patient-7\/\d+-report\.pdf$/);
  });
});

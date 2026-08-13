import { describe, it, expect } from "vitest";
import {
  ALL_FDI_NUMBERS,
  PERMANENT_FDI_NUMBERS,
  PRIMARY_FDI_NUMBERS,
  archForFdiNumber,
  dentitionForFdiNumber,
  fdiToPalmer,
  fdiToUniversal,
  isAppointmentForPatient,
  isPlannedOnChart,
  isValidFdiNumber,
  toothNeedsAttention,
} from "@/lib/dental-chart/calculations";

describe("PERMANENT_FDI_NUMBERS / PRIMARY_FDI_NUMBERS / ALL_FDI_NUMBERS", () => {
  it("has exactly 32 permanent teeth", () => {
    expect(PERMANENT_FDI_NUMBERS).toHaveLength(32);
  });

  it("has exactly 20 primary teeth — five per quadrant, not eight", () => {
    expect(PRIMARY_FDI_NUMBERS).toHaveLength(20);
  });

  it("has exactly 52 teeth total", () => {
    expect(ALL_FDI_NUMBERS).toHaveLength(52);
  });

  it("includes every permanent quadrant's full 8-tooth range", () => {
    expect(PERMANENT_FDI_NUMBERS).toEqual(
      expect.arrayContaining([11, 12, 13, 14, 15, 16, 17, 18, 21, 22, 23, 24, 25, 26, 27, 28, 31, 32, 33, 34, 35, 36, 37, 38, 41, 42, 43, 44, 45, 46, 47, 48]),
    );
  });

  it("includes every primary quadrant's 5-tooth range and excludes positions 6-8", () => {
    expect(PRIMARY_FDI_NUMBERS).toEqual(
      expect.arrayContaining([51, 52, 53, 54, 55, 61, 62, 63, 64, 65, 71, 72, 73, 74, 75, 81, 82, 83, 84, 85]),
    );
    expect(PRIMARY_FDI_NUMBERS).not.toContain(56);
    expect(PRIMARY_FDI_NUMBERS).not.toContain(58);
  });
});

describe("isValidFdiNumber", () => {
  it("accepts every real permanent and primary code", () => {
    for (const fdi of ALL_FDI_NUMBERS) {
      expect(isValidFdiNumber(fdi)).toBe(true);
    }
  });

  it("rejects a syntactically plausible but nonexistent permanent code (quadrant/position out of range)", () => {
    expect(isValidFdiNumber(19)).toBe(false);
    expect(isValidFdiNumber(10)).toBe(false);
  });

  it("rejects a primary code with position 6-8 — primary quadrants only go to 5", () => {
    expect(isValidFdiNumber(56)).toBe(false);
    expect(isValidFdiNumber(58)).toBe(false);
  });

  it("rejects an out-of-range quadrant", () => {
    expect(isValidFdiNumber(91)).toBe(false);
    expect(isValidFdiNumber(0)).toBe(false);
  });
});

describe("dentitionForFdiNumber / archForFdiNumber", () => {
  it("classifies permanent quadrants 1-4 as permanent", () => {
    expect(dentitionForFdiNumber(11)).toBe("permanent");
    expect(dentitionForFdiNumber(48)).toBe("permanent");
  });

  it("classifies primary quadrants 5-8 as primary", () => {
    expect(dentitionForFdiNumber(55)).toBe("primary");
    expect(dentitionForFdiNumber(85)).toBe("primary");
  });

  it("classifies quadrants 1, 2, 5, 6 as upper arch", () => {
    expect(archForFdiNumber(11)).toBe("upper");
    expect(archForFdiNumber(28)).toBe("upper");
    expect(archForFdiNumber(55)).toBe("upper");
    expect(archForFdiNumber(65)).toBe("upper");
  });

  it("classifies quadrants 3, 4, 7, 8 as lower arch", () => {
    expect(archForFdiNumber(31)).toBe("lower");
    expect(archForFdiNumber(48)).toBe("lower");
    expect(archForFdiNumber(75)).toBe("lower");
    expect(archForFdiNumber(85)).toBe("lower");
  });
});

describe("fdiToUniversal — display-only conversion, never stored", () => {
  it("maps the permanent arch boundaries correctly (1-32 sequence)", () => {
    expect(fdiToUniversal(18)).toBe("1");
    expect(fdiToUniversal(11)).toBe("8");
    expect(fdiToUniversal(21)).toBe("9");
    expect(fdiToUniversal(28)).toBe("16");
    expect(fdiToUniversal(38)).toBe("17");
    expect(fdiToUniversal(31)).toBe("24");
    expect(fdiToUniversal(41)).toBe("25");
    expect(fdiToUniversal(48)).toBe("32");
  });

  it("maps primary teeth to letters A-T", () => {
    expect(fdiToUniversal(55)).toBe("A");
    expect(fdiToUniversal(51)).toBe("E");
    expect(fdiToUniversal(85)).toBe("T");
  });

  it("returns null for an invalid code rather than guessing", () => {
    expect(fdiToUniversal(19)).toBeNull();
  });
});

describe("fdiToPalmer — display-only conversion, never stored", () => {
  it("matches the standard permanent Palmer convention (quadrant abbreviation + position number)", () => {
    expect(fdiToPalmer(18)).toBe("UR8");
    expect(fdiToPalmer(11)).toBe("UR1");
    expect(fdiToPalmer(21)).toBe("UL1");
    expect(fdiToPalmer(48)).toBe("LR8");
    expect(fdiToPalmer(31)).toBe("LL1");
  });

  it("uses letters A (central incisor) through E (second molar) for primary teeth", () => {
    expect(fdiToPalmer(51)).toBe("URA");
    expect(fdiToPalmer(55)).toBe("URE");
  });

  it("returns null for an invalid code rather than guessing", () => {
    expect(fdiToPalmer(59)).toBeNull();
  });
});

describe("toothNeedsAttention", () => {
  it("flags caries and watch as needing attention", () => {
    expect(toothNeedsAttention({ status: "present", condition: "caries" })).toBe(true);
    expect(toothNeedsAttention({ status: "present", condition: "watch" })).toBe(true);
  });

  it("does not flag completed restorations", () => {
    expect(toothNeedsAttention({ status: "present", condition: "filling" })).toBe(false);
    expect(toothNeedsAttention({ status: "present", condition: "crown" })).toBe(false);
    expect(toothNeedsAttention({ status: "present", condition: "root_canal" })).toBe(false);
  });

  it("does not flag a missing tooth as needing attention — absence is its own state, not an open concern", () => {
    expect(toothNeedsAttention({ status: "missing", condition: null })).toBe(false);
  });

  it("does not flag a healthy tooth", () => {
    expect(toothNeedsAttention({ status: "present", condition: null })).toBe(false);
  });
});

describe("isAppointmentForPatient", () => {
  it("returns true when the appointment belongs to the patient", () => {
    expect(isAppointmentForPatient({ patient_id: "p1" }, "p1")).toBe(true);
  });

  it("returns false when it belongs to a different patient", () => {
    expect(isAppointmentForPatient({ patient_id: "p1" }, "p2")).toBe(false);
  });

  it("treats a null appointment (not found / hidden by RLS) as not belonging", () => {
    expect(isAppointmentForPatient(null, "p1")).toBe(false);
  });
});

describe("isPlannedOnChart", () => {
  it("treats accepted and in_progress as planned", () => {
    expect(isPlannedOnChart({ status: "accepted" })).toBe(true);
    expect(isPlannedOnChart({ status: "in_progress" })).toBe(true);
  });

  it("does not treat planned/postponed/rejected/completed as an active chart marker", () => {
    expect(isPlannedOnChart({ status: "planned" })).toBe(false);
    expect(isPlannedOnChart({ status: "postponed" })).toBe(false);
    expect(isPlannedOnChart({ status: "rejected" })).toBe(false);
    expect(isPlannedOnChart({ status: "completed" })).toBe(false);
  });
});

import { describe, it, expect } from "vitest";
// buildPatientsHref is defined/exported in patients-query-params.ts and merely
// consumed by patients-filters.tsx (which has no rendering-only exports of its
// own for this function). See that file's comment: it's deliberately kept out
// of any "use client" module so it can also be called from Server Components.
import { buildPatientsHref, type PatientsQueryParams } from "@/components/patients/patients-query-params";

describe("buildPatientsHref", () => {
  it("merges base params with updates into a query string", () => {
    const base: PatientsQueryParams = { query: "smith", gender: "male" };
    const href = buildPatientsHref(base, { status: "active" });
    expect(href).toBe("/patients?query=smith&gender=male&status=active");
  });

  it("removes a key from the URL when the update sets it to undefined", () => {
    const base: PatientsQueryParams = { query: "smith", gender: "male" };
    const href = buildPatientsHref(base, { gender: undefined });
    expect(href).toBe("/patients?query=smith");
  });

  it("produces a bare /patients path when all params are empty/undefined", () => {
    const base: PatientsQueryParams = {};
    const href = buildPatientsHref(base, {});
    expect(href).toBe("/patients");
  });

  it("produces a bare /patients path when explicit values are all undefined", () => {
    const base: PatientsQueryParams = { query: undefined, gender: undefined, status: undefined };
    const href = buildPatientsHref(base, {});
    expect(href).toBe("/patients");
  });

  it("resets the page when an update explicitly sets page: undefined", () => {
    const base: PatientsQueryParams = { query: "smith", page: "3" };
    const href = buildPatientsHref(base, { page: undefined, gender: "female" });
    expect(href).toBe("/patients?query=smith&gender=female");
  });
});

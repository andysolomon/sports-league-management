import { describe, it, expect } from "vitest";
import {
  gradeToClassYear,
  summarizeClassDistribution,
  EMPTY_CLASS_DISTRIBUTION,
} from "../class-year";

describe("gradeToClassYear", () => {
  it("maps grades 9–12 to FR/SO/JR/SR", () => {
    expect(gradeToClassYear(9)).toBe("FR");
    expect(gradeToClassYear(10)).toBe("SO");
    expect(gradeToClassYear(11)).toBe("JR");
    expect(gradeToClassYear(12)).toBe("SR");
  });

  it("returns null for undefined, null, and out-of-range grades", () => {
    expect(gradeToClassYear(undefined)).toBeNull();
    expect(gradeToClassYear(null)).toBeNull();
    expect(gradeToClassYear(8)).toBeNull();
    expect(gradeToClassYear(13)).toBeNull();
    expect(gradeToClassYear(NaN)).toBeNull();
  });
});

describe("summarizeClassDistribution", () => {
  it("counts active players by class and skips graduated", () => {
    const dist = summarizeClassDistribution([
      { grade: 9, status: "Active" },
      { grade: 9, status: "Active" },
      { grade: 10, status: "Active" },
      { grade: 12, status: "graduated" },
      { grade: null, status: "Active" },
    ]);
    expect(dist).toEqual({
      FR: 2,
      SO: 1,
      JR: 0,
      SR: 0,
      unknown: 1,
    });
  });

  it("returns zeros when given no players", () => {
    expect(summarizeClassDistribution([])).toEqual(EMPTY_CLASS_DISTRIBUTION);
  });
});

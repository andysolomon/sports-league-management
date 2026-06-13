import { describe, it, expect } from "vitest";
import { seasonYearLabel } from "../attributes/season-label";

describe("seasonYearLabel (WSM-000094)", () => {
  it("extracts the four-digit year from a season name", () => {
    expect(seasonYearLabel("2026 NFL Season")).toBe("2026");
    expect(seasonYearLabel("1999 NFL Season")).toBe("1999");
  });

  it("finds the year regardless of position", () => {
    expect(seasonYearLabel("NFL Season 2024")).toBe("2024");
  });

  it("falls back to the full name when there is no year", () => {
    expect(seasonYearLabel("Preseason")).toBe("Preseason");
  });
});

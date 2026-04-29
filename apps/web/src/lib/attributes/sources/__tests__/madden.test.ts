import { describe, it, expect } from "vitest";
import { normalizeMadden } from "../madden";

describe("normalizeMadden", () => {
  it("flattens uppercase attribute fields into the canonical map", () => {
    const result = normalizeMadden({
      id: "m_1",
      POS: "QB",
      OVR: 92,
      SPD: 88,
      STR: 75,
      AWR: 91,
    });
    expect(result).toEqual({
      positionGroup: "QB",
      attributes: { OVR: 92, SPD: 88, STR: 75, AWR: 91 },
    });
  });

  it("excludes the id / name / TEAM metadata fields", () => {
    const result = normalizeMadden({
      id: "m_1",
      name: "Player",
      TEAM: "DAL",
      POS: "RB",
      OVR: 90,
    });
    expect(result?.attributes).toEqual({ OVR: 90 });
  });

  it("returns null for unknown POS", () => {
    expect(normalizeMadden({ POS: "??", OVR: 80 })).toBeNull();
  });

  it("returns null when no numeric attributes remain", () => {
    expect(
      normalizeMadden({ id: "m_1", POS: "WR", name: "X" }),
    ).toBeNull();
  });

  it("returns null for non-object input", () => {
    expect(normalizeMadden(null)).toBeNull();
    expect(normalizeMadden(42)).toBeNull();
  });
});

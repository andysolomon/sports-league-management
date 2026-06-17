import { describe, it, expect } from "vitest";
import {
  computeHsSprtRatings,
  positionToRatingGroup,
  type HsRatingInput,
} from "../lib/hsSprt";

describe("positionToRatingGroup", () => {
  it("maps roster positions to rating groups", () => {
    expect(positionToRatingGroup("QB")).toBe("QB");
    expect(positionToRatingGroup("hb")).toBe("RB");
    expect(positionToRatingGroup("CB")).toBe("DB");
    expect(positionToRatingGroup("MLB")).toBe("LB");
  });
  it("returns null for unrated positions (OL/K/unknown)", () => {
    expect(positionToRatingGroup("OL")).toBeNull();
    expect(positionToRatingGroup("K")).toBeNull();
    expect(positionToRatingGroup("XYZ")).toBeNull();
  });
});

describe("computeHsSprtRatings", () => {
  it("ranks the more productive player higher, both in 40–99", () => {
    const inputs: HsRatingInput[] = [
      { id: "a", group: "QB", games: 2, totals: { passing: { comp: 20, att: 30, yards: 600, td: 6, int: 1 } } },
      { id: "b", group: "QB", games: 2, totals: { passing: { comp: 10, att: 30, yards: 200, td: 1, int: 4 } } },
    ];
    const r = computeHsSprtRatings(inputs);
    expect(r.size).toBe(2);
    const a = r.get("a")!;
    const b = r.get("b")!;
    expect(a.overall).toBeGreaterThan(b.overall);
    expect(a.positionGroup).toBe("QB");
    expect(Object.keys(a.attributes)).toEqual(
      expect.arrayContaining(["efficiency", "production", "scoring"]),
    );
    for (const v of [a.overall, b.overall]) {
      expect(v).toBeGreaterThanOrEqual(40);
      expect(v).toBeLessThanOrEqual(99);
    }
  });

  it("skips a group with fewer than two qualified players", () => {
    const r = computeHsSprtRatings([
      { id: "solo", group: "RB", games: 3, totals: { rushing: { carries: 30, yards: 200, td: 3 } } },
    ]);
    expect(r.has("solo")).toBe(false);
  });

  it("rates each group independently", () => {
    const r = computeHsSprtRatings([
      { id: "qb1", group: "QB", games: 1, totals: { passing: { yards: 300, td: 3 } } },
      { id: "qb2", group: "QB", games: 1, totals: { passing: { yards: 100, td: 0 } } },
      { id: "db1", group: "DB", games: 1, totals: { defense: { passDef: 4, int: 2 } } },
      { id: "db2", group: "DB", games: 1, totals: { defense: { passDef: 1, int: 0 } } },
    ]);
    expect(r.get("qb1")!.positionGroup).toBe("QB");
    expect(r.get("db1")!.positionGroup).toBe("DB");
    expect(r.get("qb1")!.overall).toBeGreaterThan(r.get("qb2")!.overall);
    expect(r.get("db1")!.overall).toBeGreaterThan(r.get("db2")!.overall);
  });
});

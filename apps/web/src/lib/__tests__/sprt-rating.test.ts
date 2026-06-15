import { describe, it, expect } from "vitest";
import {
  computeSprtRatings,
  type SeasonStatLine,
  type RatingPositionGroup,
} from "../ratings/sprt";

const qb = (id: string, passingEpa: number, games = 16): {
  id: string;
  group: RatingPositionGroup;
  stats: SeasonStatLine;
} => ({
  id,
  group: "QB",
  stats: { games, passingEpa, passingYards: 4000, passingTds: 30, interceptions: 8 },
});

describe("computeSprtRatings (WSM-000091)", () => {
  it("ranks the better producer higher within a group", () => {
    const ratings = computeSprtRatings([
      qb("elite", 120),
      qb("mid", 40),
      qb("poor", -30),
    ]);
    expect(ratings.get("elite")!.overall).toBeGreaterThan(
      ratings.get("mid")!.overall,
    );
    expect(ratings.get("mid")!.overall).toBeGreaterThan(
      ratings.get("poor")!.overall,
    );
  });

  it("omits players below the group minimum games", () => {
    const ratings = computeSprtRatings([
      qb("starter", 80, 16),
      qb("benchwarmer", 80, 1),
      qb("other", 20, 16),
    ]);
    expect(ratings.has("benchwarmer")).toBe(false);
    expect(ratings.has("starter")).toBe(true);
  });

  it("keeps ratings within the 40–99 band", () => {
    const ratings = computeSprtRatings([
      qb("ceiling", 99999),
      qb("floor", -99999),
      qb("mid", 0),
    ]);
    for (const r of ratings.values()) {
      expect(r.overall).toBeGreaterThanOrEqual(40);
      expect(r.overall).toBeLessThanOrEqual(99);
    }
  });

  it("skips a group with fewer than two qualified players", () => {
    const ratings = computeSprtRatings([qb("lonely", 50)]);
    expect(ratings.size).toBe(0);
  });

  it("rates each position group independently", () => {
    const ratings = computeSprtRatings([
      { id: "wr1", group: "WR", stats: { games: 16, receivingEpa: 50, receivingYards: 1400, receptions: 100, targets: 140, receivingYac: 600 } },
      { id: "wr2", group: "WR", stats: { games: 16, receivingEpa: 10, receivingYards: 700, receptions: 50, targets: 90, receivingYac: 300 } },
      { id: "db1", group: "DB", stats: { games: 16, defPassDefended: 18, defInterceptions: 6, defTackles: 70 } },
      { id: "db2", group: "DB", stats: { games: 16, defPassDefended: 6, defInterceptions: 1, defTackles: 40 } },
    ]);
    expect(ratings.get("wr1")!.overall).toBeGreaterThan(ratings.get("wr2")!.overall);
    expect(ratings.get("db1")!.overall).toBeGreaterThan(ratings.get("db2")!.overall);
    expect(ratings.get("wr1")!.positionGroup).toBe("WR");
    expect(ratings.get("db1")!.positionGroup).toBe("DB");
  });

  it("exposes component sub-scores in the 40–99 band", () => {
    const ratings = computeSprtRatings([qb("a", 100), qb("b", 0), qb("c", -50)]);
    const attrs = ratings.get("a")!.attributes;
    expect(Object.keys(attrs)).toContain("efficiency");
    for (const v of Object.values(attrs)) {
      expect(v).toBeGreaterThanOrEqual(40);
      expect(v).toBeLessThanOrEqual(99);
    }
  });
});

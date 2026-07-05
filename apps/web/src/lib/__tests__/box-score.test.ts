import { describe, expect, it } from "vitest";
import type { PlayerGameStatsDto } from "@sports-management/shared-types";
import { buildBoxScoreTables, type BoxScorePlayerInfo } from "../box-score";

function statLine(
  playerId: string,
  stats: PlayerGameStatsDto["stats"],
): PlayerGameStatsDto {
  return {
    id: `stat-${playerId}`,
    fixtureId: "fx1",
    playerId,
    teamId: "team1",
    seasonId: "season1",
    stats,
    enteredBy: "user1",
    updatedAt: "2026-07-05T00:00:00Z",
  };
}

const players = new Map<string, BoxScorePlayerInfo>([
  ["p1", { name: "Alpha QB", jerseyNumber: 7 }],
  ["p2", { name: "Bravo RB", jerseyNumber: 22 }],
  ["p3", { name: "Charlie WR", jerseyNumber: 81 }],
]);

describe("buildBoxScoreTables", () => {
  it("builds one table per stat group present, in STAT_GROUPS order", () => {
    const tables = buildBoxScoreTables(
      [
        statLine("p1", { passing: { comp: 18, att: 25, yards: 240, td: 2 } }),
        statLine("p2", { rushing: { carries: 14, yards: 88, td: 1 } }),
      ],
      players,
    );
    expect(tables.map((t) => t.key)).toEqual(["passing", "rushing"]);
    expect(tables[0].label).toBe("Passing");
    expect(tables[0].fields.map((f) => f.label)).toContain("Yds");
  });

  it("omits groups with no entered lines", () => {
    const tables = buildBoxScoreTables(
      [statLine("p1", { passing: { yards: 100 } })],
      players,
    );
    expect(tables.find((t) => t.key === "defense")).toBeUndefined();
  });

  it("maps field values in field order with null for missing fields", () => {
    const tables = buildBoxScoreTables(
      [statLine("p1", { passing: { comp: 10, yards: 150 } })],
      players,
    );
    const passing = tables[0];
    const compIdx = passing.fields.findIndex((f) => f.key === "comp");
    const attIdx = passing.fields.findIndex((f) => f.key === "att");
    const yardsIdx = passing.fields.findIndex((f) => f.key === "yards");
    expect(passing.rows[0].values[compIdx]).toBe(10);
    expect(passing.rows[0].values[attIdx]).toBeNull();
    expect(passing.rows[0].values[yardsIdx]).toBe(150);
  });

  it("sorts rows by the group's first field descending", () => {
    const tables = buildBoxScoreTables(
      [
        statLine("p2", { rushing: { carries: 5, yards: 30 } }),
        statLine("p1", { rushing: { carries: 15, yards: 90 } }),
      ],
      players,
    );
    const rushing = tables.find((t) => t.key === "rushing")!;
    expect(rushing.rows.map((r) => r.playerId)).toEqual(["p1", "p2"]);
  });

  it("resolves player name and jersey, tolerating unknown players", () => {
    const tables = buildBoxScoreTables(
      [
        statLine("p3", { receiving: { rec: 6, yards: 72 } }),
        statLine("ghost", { receiving: { rec: 2, yards: 12 } }),
      ],
      players,
    );
    const receiving = tables.find((t) => t.key === "receiving")!;
    expect(receiving.rows[0]).toMatchObject({
      playerName: "Charlie WR",
      jerseyNumber: 81,
    });
    expect(receiving.rows[1]).toMatchObject({
      playerName: "Unknown player",
      jerseyNumber: null,
    });
  });

  it("skips lines whose group object has no numeric values", () => {
    const tables = buildBoxScoreTables(
      [statLine("p1", { passing: {} })],
      players,
    );
    expect(tables).toEqual([]);
  });

  it("returns empty for no stat lines", () => {
    expect(buildBoxScoreTables([], players)).toEqual([]);
  });
});

import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { LeagueDto, TeamDto } from "@sports-management/shared-types";
import { WsmLocalDb } from "../local-db";
import { LocalWorkspaceProvider } from "../local-workspace-provider";

let db: WsmLocalDb;
let provider: LocalWorkspaceProvider;
let counter = 0;

beforeEach(() => {
  db = new WsmLocalDb(`wsm-local-sched-test-${counter++}`);
  provider = new LocalWorkspaceProvider(db);
});

afterEach(async () => {
  await db.delete();
});

async function team(league: LeagueDto, name: string): Promise<TeamDto> {
  return provider.createTeam({ name, leagueId: league.id, city: "x", stadium: "y" });
}

describe("LocalWorkspaceProvider — seasons", () => {
  it("creates, lists, updates and cascade-deletes a season", async () => {
    const league = await provider.createLeague({ name: "L" });
    const season = await provider.createSeason({ name: "2026", leagueId: league.id });
    expect(season.status).toBe("active");
    expect(await provider.listSeasons(league.id)).toHaveLength(1);

    const renamed = await provider.updateSeason(season.id, { name: "2026-27" });
    expect(renamed?.name).toBe("2026-27");

    // Cascade: a fixture + its result vanish with the season.
    const a = await team(league, "A");
    const b = await team(league, "B");
    const fx = await provider.createFixture({ seasonId: season.id, homeTeamId: a.id, awayTeamId: b.id });
    await provider.recordGameResult(fx.id, 21, 14);

    await provider.deleteSeason(season.id);
    expect(await provider.listSeasons(league.id)).toEqual([]);
    expect(await provider.listFixturesBySeason(season.id)).toEqual([]);
    expect(await provider.getResultByFixture(fx.id)).toBeNull();
  });
});

describe("LocalWorkspaceProvider — fixtures & results", () => {
  it("denormalizes team names onto the fixture", async () => {
    const league = await provider.createLeague({ name: "L" });
    const season = await provider.createSeason({ name: "S", leagueId: league.id });
    const a = await team(league, "Hawks");
    const b = await team(league, "Owls");
    const fx = await provider.createFixture({ seasonId: season.id, homeTeamId: a.id, awayTeamId: b.id, week: 1 });
    expect(fx).toMatchObject({
      homeTeamName: "Hawks",
      awayTeamName: "Owls",
      status: "scheduled",
      week: 1,
    });
  });

  it("throws when a fixture references a missing team", async () => {
    const league = await provider.createLeague({ name: "L" });
    const season = await provider.createSeason({ name: "S", leagueId: league.id });
    const a = await team(league, "A");
    await expect(
      provider.createFixture({ seasonId: season.id, homeTeamId: a.id, awayTeamId: "nope" }),
    ).rejects.toThrow("not found");
  });

  it("finalizes a fixture on result and overwrites on re-record", async () => {
    const league = await provider.createLeague({ name: "L" });
    const season = await provider.createSeason({ name: "S", leagueId: league.id });
    const a = await team(league, "A");
    const b = await team(league, "B");
    const fx = await provider.createFixture({ seasonId: season.id, homeTeamId: a.id, awayTeamId: b.id });

    await provider.recordGameResult(fx.id, 21, 14);
    let fixtures = await provider.listFixturesBySeason(season.id);
    expect(fixtures[0].status).toBe("final");

    // Re-record: a single result per fixture, overwritten in place.
    await provider.recordGameResult(fx.id, 7, 7);
    const result = await provider.getResultByFixture(fx.id);
    expect(result).toMatchObject({ homeScore: 7, awayScore: 7 });
    expect(
      (await db.gameResults.where("fixtureId").equals(fx.id).toArray()).length,
    ).toBe(1);

    await provider.deleteFixture(fx.id);
    expect(await provider.getResultByFixture(fx.id)).toBeNull();
  });
});

describe("LocalWorkspaceProvider — standings (shared pure fn)", () => {
  it("computes wins/points/ranks and ignores fixtures with no result", async () => {
    const league = await provider.createLeague({ name: "L" });
    const season = await provider.createSeason({ name: "S", leagueId: league.id });
    const a = await team(league, "A");
    const b = await team(league, "B");
    const c = await team(league, "C");

    // A beat B 21-14; B beat C 10-7; A vs C scheduled (no result → ignored).
    const ab = await provider.createFixture({ seasonId: season.id, homeTeamId: a.id, awayTeamId: b.id });
    const bc = await provider.createFixture({ seasonId: season.id, homeTeamId: b.id, awayTeamId: c.id });
    await provider.createFixture({ seasonId: season.id, homeTeamId: a.id, awayTeamId: c.id });
    await provider.recordGameResult(ab.id, 21, 14);
    await provider.recordGameResult(bc.id, 10, 7);

    const standings = await provider.computeStandings(season.id);
    const byTeam = new Map(standings.map((s) => [s.teamId, s]));

    expect(byTeam.get(a.id)).toMatchObject({ wins: 1, losses: 0, pointsFor: 21, pointsAgainst: 14 });
    expect(byTeam.get(b.id)).toMatchObject({ wins: 1, losses: 1 });
    expect(byTeam.get(c.id)).toMatchObject({ wins: 0, losses: 1 });

    // A and B tie on wins (1 each); head-to-head (A beat B) ranks A first.
    expect(byTeam.get(a.id)?.leagueRank).toBe(1);
    expect(byTeam.get(b.id)?.leagueRank).toBe(2);
    expect(byTeam.get(c.id)?.leagueRank).toBe(3);
  });

  it("returns [] for an unknown season", async () => {
    expect(await provider.computeStandings("nope")).toEqual([]);
  });
});

import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LeagueImportSchema } from "@sports-management/api-contracts";
import { WsmLocalDb } from "../local-db";
import { LocalWorkspaceProvider } from "../local-workspace-provider";
import {
  clearLocalWorkspace,
  hasLocalData,
  serializeLocalWorkspace,
  UNASSIGNED_DIVISION,
} from "../local-export";

let db: WsmLocalDb;
let provider: LocalWorkspaceProvider;
let counter = 0;

beforeEach(() => {
  db = new WsmLocalDb(`wsm-local-export-test-${counter++}`);
  provider = new LocalWorkspaceProvider(db);
});

afterEach(async () => {
  await db.delete();
});

describe("serializeLocalWorkspace", () => {
  it("returns null when there is nothing to migrate", async () => {
    expect(await serializeLocalWorkspace(provider)).toBeNull();
    await provider.createLeague({ name: "Empty" });
    // A league with no teams still has nothing worth migrating.
    expect(await serializeLocalWorkspace(provider)).toBeNull();
  });

  it("serializes teams, divisions, players, season and schedule with counts", async () => {
    const league = await provider.createLeague({ name: "My Program" });
    const east = await provider.createDivision({ name: "East", leagueId: league.id });
    const hawks = await provider.createTeam({ name: "Hawks", leagueId: league.id, city: "Austin", stadium: "Nest" });
    await provider.updateTeam(hawks.id, { divisionId: east.id });
    const bears = await provider.createTeam({ name: "Bears", leagueId: league.id, city: "Dallas", stadium: "Den" });
    await provider.createPlayer({ name: "Pat", teamId: hawks.id, position: "QB", jerseyNumber: 12, dateOfBirth: null, status: "Active" });

    const season = await provider.createSeason({ name: "2026", leagueId: league.id });
    const fx = await provider.createFixture({ seasonId: season.id, homeTeamId: hawks.id, awayTeamId: bears.id, week: 1 });
    await provider.recordGameResult(fx.id, 21, 14);

    const exported = (await serializeLocalWorkspace(provider))!;
    expect(exported).not.toBeNull();
    expect(exported.league.name).toBe("My Program");
    expect(exported.counts).toEqual({
      divisions: 2, // East + synthetic Unassigned (for Bears)
      teams: 2,
      players: 1,
      seasons: 1,
      fixtures: 1,
    });

    // Bears (no division) is bucketed under "Unassigned".
    const unassigned = exported.divisions.find((d) => d.name === UNASSIGNED_DIVISION);
    expect(unassigned?.teams.map((t) => t.name)).toEqual(["Bears"]);

    // Schedule is re-keyed by name and carries the result.
    expect(exported.fixtures[0]).toMatchObject({
      seasonName: "2026",
      homeTeamName: "Hawks",
      awayTeamName: "Bears",
      week: 1,
      result: { homeScore: 21, awayScore: 14 },
    });
  });

  it("produces a { league, divisions } head that is a valid import payload", async () => {
    const league = await provider.createLeague({ name: "Metro" });
    await provider.createTeam({ name: "Hawks", leagueId: league.id, city: "Austin", stadium: "Nest" });

    const exported = (await serializeLocalWorkspace(provider))!;
    const parsed = LeagueImportSchema.safeParse({
      league: exported.league,
      divisions: exported.divisions,
    });
    expect(parsed.success).toBe(true);
  });
});

describe("hasLocalData / clearLocalWorkspace", () => {
  it("detects and then wipes a local workspace", async () => {
    const league = await provider.createLeague({ name: "L" });
    const team = await provider.createTeam({ name: "Hawks", leagueId: league.id, city: "x", stadium: "y" });
    await provider.createPlayer({ name: "P", teamId: team.id, position: "QB", jerseyNumber: 1, dateOfBirth: null, status: "Active" });
    const season = await provider.createSeason({ name: "S", leagueId: league.id });
    await provider.createFixture({ seasonId: season.id, homeTeamId: team.id, awayTeamId: team.id, week: 1 }).catch(() => {});

    expect(await hasLocalData(provider)).toBe(true);

    await clearLocalWorkspace(db);

    expect(await hasLocalData(provider)).toBe(false);
    expect(await provider.listLeagues()).toEqual([]);
    expect(await provider.listTeams(league.id)).toEqual([]);
    expect(await provider.listSeasons(league.id)).toEqual([]);
  });
});

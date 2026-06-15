import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LeagueImportSchema } from "@sports-management/api-contracts";
import { csvToLeagueImport } from "../../csv-import";
import { WsmLocalDb } from "../local-db";
import { LocalWorkspaceProvider } from "../local-workspace-provider";
import { importLeagueIntoLocal } from "../local-import";

let db: WsmLocalDb;
let provider: LocalWorkspaceProvider;
let counter = 0;

beforeEach(() => {
  db = new WsmLocalDb(`wsm-local-import-test-${counter++}`);
  provider = new LocalWorkspaceProvider(db);
});

afterEach(async () => {
  await db.delete();
});

const HEADER =
  "league,division,team,city,stadium,teamLogoUrl,playerName,position,jerseyNumber,dateOfBirth,status,headshotUrl,experienceYears";

const CSV = [
  HEADER,
  "Metro,East,Hawks,Austin,Nest Field,,Pat Lee,QB,12,,Active,,",
  "Metro,East,Hawks,Austin,Nest Field,,Sam Roe,RB,28,,Active,,",
  "Metro,West,Bears,Dallas,Den Stadium,,Jo Fox,WR,80,,Active,,",
].join("\n");

/** CSV → validated LeagueImportPayload, exactly as the UI produces it. */
function payloadFromCsv(csv: string) {
  const { payload } = csvToLeagueImport(csv);
  return LeagueImportSchema.parse(payload);
}

describe("importLeagueIntoLocal", () => {
  it("seeds divisions, teams and players into the local league", async () => {
    const result = await importLeagueIntoLocal(provider, payloadFromCsv(CSV));
    expect(result.created).toEqual({ divisions: 2, teams: 2, players: 3 });

    const leagues = await provider.listLeagues();
    expect(leagues).toHaveLength(1);
    const leagueId = leagues[0].id;

    const divisions = await provider.listDivisions(leagueId);
    expect(divisions.map((d) => d.name).sort()).toEqual(["East", "West"]);

    const teams = await provider.listTeams(leagueId);
    expect(teams).toHaveLength(2);

    const hawks = teams.find((t) => t.name === "Hawks")!;
    const east = divisions.find((d) => d.name === "East")!;
    // Team is placed in its imported division.
    expect(hawks.divisionId).toBe(east.id);
    expect(await provider.listPlayersByTeam(hawks.id)).toHaveLength(2);
  });

  it("is idempotent — re-importing the same payload adds nothing", async () => {
    await importLeagueIntoLocal(provider, payloadFromCsv(CSV));
    const second = await importLeagueIntoLocal(provider, payloadFromCsv(CSV));
    expect(second.created).toEqual({ divisions: 0, teams: 0, players: 0 });

    const leagueId = (await provider.listLeagues())[0].id;
    expect(await provider.listTeams(leagueId)).toHaveLength(2);
    expect(await provider.listDivisions(leagueId)).toHaveLength(2);
  });

  it("merges into an existing local workspace, adding only new records", async () => {
    // Pre-seed one team by hand.
    const league = (await provider.listLeagues())[0]
      ? (await provider.listLeagues())[0]
      : await provider.createLeague({ name: "My Program" });
    await provider.createTeam({
      name: "Hawks",
      leagueId: league.id,
      city: "Austin",
      stadium: "Nest Field",
    });

    const result = await importLeagueIntoLocal(provider, payloadFromCsv(CSV));
    // Hawks already existed → only Bears is a new team; both divisions are new.
    expect(result.created.teams).toBe(1);
    expect(result.created.divisions).toBe(2);
  });
});

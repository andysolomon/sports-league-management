// Polyfill IndexedDB for the node test environment (vitest runs in `node`).
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { WsmLocalDb } from "../local-db";
import { LocalWorkspaceProvider } from "../local-workspace-provider";
import { DuplicateJerseyError } from "../workspace-provider";

let db: WsmLocalDb;
let provider: LocalWorkspaceProvider;
// Unique DB name per test so stores never leak across cases.
let counter = 0;

beforeEach(() => {
  db = new WsmLocalDb(`wsm-local-test-${counter++}`);
  provider = new LocalWorkspaceProvider(db);
});

afterEach(async () => {
  await db.delete();
});

/** Seed a league + team and return both. */
async function seedTeam(allowDuplicateJerseys = true) {
  const league = await provider.createLeague({ name: "My League" });
  const team = await provider.createTeam({
    name: "Hawks",
    leagueId: league.id,
    city: "Austin",
    stadium: "Nest Field",
  });
  if (!allowDuplicateJerseys) {
    await provider.updateTeam(team.id, { allowDuplicateJerseys: false });
  }
  return { league, team };
}

describe("LocalWorkspaceProvider — leagues", () => {
  it("creates a league with a generated id and null org", async () => {
    const league = await provider.createLeague({ name: "My League" });
    expect(league.id).toMatch(/[0-9a-f-]{36}/);
    expect(league.orgId).toBeNull();
    expect(await provider.getLeague(league.id)).toEqual(league);
    expect(await provider.listLeagues()).toHaveLength(1);
  });
});

describe("LocalWorkspaceProvider — teams", () => {
  it("creates a team with server-matching defaults", async () => {
    const league = await provider.createLeague({ name: "L" });
    const team = await provider.createTeam({
      name: "Hawks",
      leagueId: league.id,
      city: "Austin",
      stadium: "Nest Field",
    });
    expect(team).toMatchObject({
      name: "Hawks",
      leagueId: league.id,
      city: "Austin",
      stadium: "Nest Field",
      location: "Austin", // seeded from city
      divisionId: "", // no division yet
      rosterLimit: 53,
      allowDuplicateJerseys: true,
      foundedYear: null,
      logoUrl: null,
      teamName: null,
    });
  });

  it("lists teams, optionally filtered by league", async () => {
    const a = await provider.createLeague({ name: "A" });
    const b = await provider.createLeague({ name: "B" });
    await provider.createTeam({ name: "T1", leagueId: a.id, city: "x", stadium: "y" });
    await provider.createTeam({ name: "T2", leagueId: b.id, city: "x", stadium: "y" });
    expect(await provider.listTeams()).toHaveLength(2);
    expect(await provider.listTeams(a.id)).toHaveLength(1);
    expect((await provider.listTeams(a.id))[0].name).toBe("T1");
  });

  it("updates only the provided fields", async () => {
    const { team } = await seedTeam();
    const updated = await provider.updateTeam(team.id, {
      city: "Dallas",
      primaryColor: "#1e3a8a",
    });
    expect(updated).toMatchObject({
      name: "Hawks", // untouched
      city: "Dallas", // changed
      primaryColor: "#1e3a8a", // changed
    });
  });

  it("returns null when updating a missing team", async () => {
    expect(await provider.updateTeam("nope", { city: "X" })).toBeNull();
  });

  it("cascade-deletes the roster with the team", async () => {
    const { team } = await seedTeam();
    await provider.createPlayer({
      name: "Pat",
      teamId: team.id,
      position: "QB",
      jerseyNumber: 12,
      dateOfBirth: null,
      status: "Active",
    });
    await provider.deleteTeam(team.id);
    expect(await provider.getTeam(team.id)).toBeNull();
    expect(await provider.listPlayersByTeam(team.id)).toEqual([]);
  });
});

describe("LocalWorkspaceProvider — divisions", () => {
  it("creates, lists, updates and deletes divisions", async () => {
    const league = await provider.createLeague({ name: "L" });
    const div = await provider.createDivision({ name: "East", leagueId: league.id });
    expect(div.conferenceId).toBeNull();
    expect(await provider.listDivisions(league.id)).toHaveLength(1);

    const renamed = await provider.updateDivision(div.id, { name: "West" });
    expect(renamed?.name).toBe("West");

    await provider.deleteDivision(div.id);
    expect(await provider.listDivisions(league.id)).toEqual([]);
  });
});

describe("LocalWorkspaceProvider — players & jersey policy", () => {
  it("creates a player with server-matching defaults", async () => {
    const { team } = await seedTeam();
    const player = await provider.createPlayer({
      name: "Pat Lee",
      teamId: team.id,
      position: "QB",
      jerseyNumber: 12,
      dateOfBirth: "2003-09-01",
      status: "Active",
    });
    expect(player).toMatchObject({
      name: "Pat Lee",
      teamId: team.id,
      position: "QB",
      jerseyNumber: 12,
      status: "Active",
      positionGroup: null,
      headshotUrl: null,
      experienceYears: null,
    });
  });

  it("throws creating a player on a missing team", async () => {
    await expect(
      provider.createPlayer({
        name: "X",
        teamId: "nope",
        position: "QB",
        jerseyNumber: 1,
        dateOfBirth: null,
        status: "Active",
      }),
    ).rejects.toThrow("Team not found");
  });

  it("allows duplicate jerseys when the team policy permits", async () => {
    const { team } = await seedTeam(true);
    await provider.createPlayer({ name: "A", teamId: team.id, position: "QB", jerseyNumber: 7, dateOfBirth: null, status: "Active" });
    await expect(
      provider.createPlayer({ name: "B", teamId: team.id, position: "RB", jerseyNumber: 7, dateOfBirth: null, status: "Active" }),
    ).resolves.toBeTruthy();
  });

  it("rejects a duplicate active jersey when the policy forbids it", async () => {
    const { team } = await seedTeam(false);
    await provider.createPlayer({ name: "A", teamId: team.id, position: "QB", jerseyNumber: 7, dateOfBirth: null, status: "Active" });
    await expect(
      provider.createPlayer({ name: "B", teamId: team.id, position: "RB", jerseyNumber: 7, dateOfBirth: null, status: "Active" }),
    ).rejects.toBeInstanceOf(DuplicateJerseyError);
  });

  it("ignores inactive wearers and null jerseys under a strict policy", async () => {
    const { team } = await seedTeam(false);
    await provider.createPlayer({ name: "A", teamId: team.id, position: "QB", jerseyNumber: 7, dateOfBirth: null, status: "Inactive" });
    // #7 is free because the existing wearer is inactive.
    await expect(
      provider.createPlayer({ name: "B", teamId: team.id, position: "RB", jerseyNumber: 7, dateOfBirth: null, status: "Active" }),
    ).resolves.toBeTruthy();
    // null jersey never conflicts.
    await expect(
      provider.createPlayer({ name: "C", teamId: team.id, position: "WR", jerseyNumber: null, dateOfBirth: null, status: "Active" }),
    ).resolves.toBeTruthy();
  });

  it("does not flag the player being edited as its own duplicate", async () => {
    const { team } = await seedTeam(false);
    const p = await provider.createPlayer({ name: "A", teamId: team.id, position: "QB", jerseyNumber: 7, dateOfBirth: null, status: "Active" });
    const updated = await provider.updatePlayer(p.id, { name: "A. Lee" });
    expect(updated?.name).toBe("A. Lee");
    expect(updated?.jerseyNumber).toBe(7);
  });

  it("deletes a player", async () => {
    const { team } = await seedTeam();
    const p = await provider.createPlayer({ name: "A", teamId: team.id, position: "QB", jerseyNumber: 1, dateOfBirth: null, status: "Active" });
    await provider.deletePlayer(p.id);
    expect(await provider.getPlayer(p.id)).toBeNull();
  });
});

describe("LocalWorkspaceProvider — persistence", () => {
  it("persists data across a fresh DB handle to the same database", async () => {
    const league = await provider.createLeague({ name: "Persisted" });
    const team = await provider.createTeam({ name: "Hawks", leagueId: league.id, city: "Austin", stadium: "Nest" });
    await provider.createPlayer({ name: "Pat", teamId: team.id, position: "QB", jerseyNumber: 12, dateOfBirth: null, status: "Active" });

    // Simulate a page reload: a brand-new handle/provider over the SAME db name.
    const reopened = new LocalWorkspaceProvider(new WsmLocalDb(db.name));
    expect(await reopened.listLeagues()).toHaveLength(1);
    expect((await reopened.listTeams())[0].name).toBe("Hawks");
    expect(await reopened.listPlayersByTeam(team.id)).toHaveLength(1);
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockFlag,
  mockAuth,
  mockCanManageTeam,
  mockResolveOrgContext,
  mockResolveOrgRole,
  mockGetPlayersByTeam,
  mockGetPlayers,
  mockGetTeamsByLeague,
  mockGetTeamLeagueId,
  mockGetLeagueOrgId,
  mockGetSeasons,
  mockListFixturesBySeason,
  mockBulkCreatePlayers,
  mockClearSyntheticPlayers,
} = vi.hoisted(() => ({
  mockFlag: vi.fn(),
  mockAuth: vi.fn(),
  mockCanManageTeam: vi.fn(),
  mockResolveOrgContext: vi.fn(),
  mockResolveOrgRole: vi.fn(),
  mockGetPlayersByTeam: vi.fn(),
  mockGetPlayers: vi.fn(),
  mockGetTeamsByLeague: vi.fn(),
  mockGetTeamLeagueId: vi.fn(),
  mockGetLeagueOrgId: vi.fn(),
  mockGetSeasons: vi.fn(),
  mockListFixturesBySeason: vi.fn(),
  mockBulkCreatePlayers: vi.fn(),
  mockClearSyntheticPlayers: vi.fn(),
}));

vi.mock("@/lib/flags", () => ({ syntheticRostersV1: mockFlag }));
vi.mock("@clerk/nextjs/server", () => ({ auth: mockAuth }));
vi.mock("@/lib/authorization", () => ({ canManageTeam: mockCanManageTeam }));
vi.mock("@/lib/org-context", () => ({
  resolveOrgContext: mockResolveOrgContext,
  resolveOrgRole: mockResolveOrgRole,
}));
vi.mock("@/lib/data-api", () => ({
  getPlayersByTeam: mockGetPlayersByTeam,
  getPlayers: mockGetPlayers,
  getTeamsByLeague: mockGetTeamsByLeague,
  getTeamLeagueId: mockGetTeamLeagueId,
  getLeagueOrgId: mockGetLeagueOrgId,
  getSeasons: mockGetSeasons,
  listFixturesBySeason: mockListFixturesBySeason,
  bulkCreatePlayers: mockBulkCreatePlayers,
  clearSyntheticPlayers: mockClearSyntheticPlayers,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
// @/lib/permissions (canManageOrgSettings) and @/lib/synthetic-roster are real.

import {
  generateTeamRosterAction,
  generateLeagueRostersAction,
  clearTeamSyntheticAction,
  clearLeagueSyntheticAction,
  getLeagueRosterDeficitAction,
  fillDeficientRostersAction,
} from "../synthetic-rosters";

const TEAM = "team_1";
const LEAGUE = "league_1";
const ORG = "org_1";

beforeEach(() => {
  vi.clearAllMocks();
  mockFlag.mockResolvedValue(true);
  mockAuth.mockResolvedValue({ userId: "user_1" });
  mockResolveOrgContext.mockResolvedValue({ visibleLeagueIds: [LEAGUE], orgIds: [ORG] });
  mockGetTeamLeagueId.mockResolvedValue(LEAGUE);
  mockGetSeasons.mockResolvedValue([
    { id: "season_1", status: "active", rosterLocked: false },
  ]);
  mockListFixturesBySeason.mockResolvedValue([]);
  mockGetPlayers.mockResolvedValue([]);
});

describe("generateTeamRosterAction", () => {
  beforeEach(() => {
    mockCanManageTeam.mockResolvedValue(true);
    mockGetPlayersByTeam.mockResolvedValue([]); // empty team
    mockBulkCreatePlayers.mockResolvedValue({ created: 48 });
  });

  it("blocks when the flag is off", async () => {
    mockFlag.mockResolvedValue(false);
    expect(await generateTeamRosterAction({ teamId: TEAM })).toEqual({ ok: false, error: "flag_disabled" });
    expect(mockBulkCreatePlayers).not.toHaveBeenCalled();
  });

  it("blocks an unauthenticated caller", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    expect(await generateTeamRosterAction({ teamId: TEAM })).toEqual({ ok: false, error: "unauthorized" });
  });

  it("rejects a caller who can't manage the team", async () => {
    mockCanManageTeam.mockResolvedValue(false);
    expect(await generateTeamRosterAction({ teamId: TEAM })).toEqual({ ok: false, error: "not_authorized" });
    expect(mockBulkCreatePlayers).not.toHaveBeenCalled();
  });

  it("generates a full roster onto an empty team", async () => {
    const res = await generateTeamRosterAction({ teamId: TEAM });
    expect(res).toEqual({ ok: true, created: 48 });
    // bulkCreatePlayers called with teamId + 48 generated players.
    const [teamId, players] = mockBulkCreatePlayers.mock.calls[0];
    expect(teamId).toBe(TEAM);
    expect(players).toHaveLength(48);
    expect(players[0]).toHaveProperty("position");
    expect(players[0]).toHaveProperty("jerseyNumber");
  });

  it("fills to count (creates nothing when already full)", async () => {
    mockGetPlayersByTeam.mockResolvedValue(
      Array.from({ length: 50 }, (_, i) => ({ jerseyNumber: i })),
    );
    const res = await generateTeamRosterAction({ teamId: TEAM, count: 48 });
    expect(res).toEqual({ ok: true, created: 0 });
    expect(mockBulkCreatePlayers).not.toHaveBeenCalled();
  });

  it("blocks when the active season has started", async () => {
    mockListFixturesBySeason.mockResolvedValue([{ status: "final" }]);
    expect(await generateTeamRosterAction({ teamId: TEAM })).toEqual({
      ok: false,
      error: "season_started",
    });
    expect(mockBulkCreatePlayers).not.toHaveBeenCalled();
  });
});

describe("generateLeagueRostersAction", () => {
  beforeEach(() => {
    mockGetLeagueOrgId.mockResolvedValue(ORG);
    mockResolveOrgRole.mockResolvedValue("admin");
    mockGetTeamsByLeague.mockResolvedValue([{ id: "t1" }, { id: "t2" }]);
    mockGetPlayersByTeam.mockResolvedValue([]);
    mockBulkCreatePlayers.mockResolvedValue({ created: 48 });
  });

  it("is admin-only (coach rejected)", async () => {
    mockResolveOrgRole.mockResolvedValue("coach");
    expect(await generateLeagueRostersAction({ leagueId: LEAGUE })).toEqual({ ok: false, error: "not_authorized" });
    expect(mockBulkCreatePlayers).not.toHaveBeenCalled();
  });

  it("blocks when the flag is off", async () => {
    mockFlag.mockResolvedValue(false);
    expect(await generateLeagueRostersAction({ leagueId: LEAGUE })).toEqual({ ok: false, error: "flag_disabled" });
  });

  it("fills every team and aggregates the counts", async () => {
    const res = await generateLeagueRostersAction({ leagueId: LEAGUE });
    expect(res).toEqual({ ok: true, teams: 2, created: 96 });
    expect(mockBulkCreatePlayers).toHaveBeenCalledTimes(2);
  });
});

describe("clearTeamSyntheticAction", () => {
  beforeEach(() => {
    mockCanManageTeam.mockResolvedValue(true);
    mockClearSyntheticPlayers.mockResolvedValue({ deleted: 48 });
  });

  it("blocks when the flag is off", async () => {
    mockFlag.mockResolvedValue(false);
    expect(await clearTeamSyntheticAction({ teamId: TEAM })).toEqual({ ok: false, error: "flag_disabled" });
    expect(mockClearSyntheticPlayers).not.toHaveBeenCalled();
  });

  it("rejects a caller who can't manage the team", async () => {
    mockCanManageTeam.mockResolvedValue(false);
    expect(await clearTeamSyntheticAction({ teamId: TEAM })).toEqual({ ok: false, error: "not_authorized" });
    expect(mockClearSyntheticPlayers).not.toHaveBeenCalled();
  });

  it("deletes synthetic players on the team", async () => {
    const res = await clearTeamSyntheticAction({ teamId: TEAM });
    expect(res).toEqual({ ok: true, deleted: 48 });
    expect(mockClearSyntheticPlayers).toHaveBeenCalledWith(TEAM);
  });
});

describe("clearLeagueSyntheticAction", () => {
  beforeEach(() => {
    mockGetLeagueOrgId.mockResolvedValue(ORG);
    mockResolveOrgRole.mockResolvedValue("admin");
    mockGetTeamsByLeague.mockResolvedValue([{ id: "t1" }, { id: "t2" }]);
    mockClearSyntheticPlayers.mockResolvedValue({ deleted: 10 });
  });

  it("is admin-only (coach rejected)", async () => {
    mockResolveOrgRole.mockResolvedValue("coach");
    expect(await clearLeagueSyntheticAction({ leagueId: LEAGUE })).toEqual({ ok: false, error: "not_authorized" });
    expect(mockClearSyntheticPlayers).not.toHaveBeenCalled();
  });

  it("clears every team and aggregates the deletions", async () => {
    const res = await clearLeagueSyntheticAction({ leagueId: LEAGUE });
    expect(res).toEqual({ ok: true, teams: 2, deleted: 20 });
    expect(mockClearSyntheticPlayers).toHaveBeenCalledTimes(2);
  });
});

describe("getLeagueRosterDeficitAction", () => {
  beforeEach(() => {
    mockGetTeamsByLeague.mockResolvedValue([
      { id: "t1", name: "Alpha" },
      { id: "t2", name: "Beta" },
    ]);
    mockGetPlayers.mockResolvedValue([
      { id: "p1", teamId: "t1", status: "active" },
      { id: "p2", teamId: "t2", status: "active" },
    ]);
  });

  it("returns only deficient teams with target size", async () => {
    const res = await getLeagueRosterDeficitAction({ leagueId: LEAGUE });
    expect(res).toEqual({
      ok: true,
      target: 48,
      teams: [
        {
          id: "t1",
          name: "Alpha",
          activeCount: 1,
          target: 48,
          deficit: 47,
        },
        {
          id: "t2",
          name: "Beta",
          activeCount: 1,
          target: 48,
          deficit: 47,
        },
      ],
    });
  });

  it("rejects viewers without visible league access", async () => {
    mockResolveOrgContext.mockResolvedValue({ visibleLeagueIds: [], orgIds: [] });
    expect(await getLeagueRosterDeficitAction({ leagueId: LEAGUE })).toEqual({
      ok: false,
      error: "not_authorized",
    });
  });
});

describe("fillDeficientRostersAction", () => {
  beforeEach(() => {
    mockGetLeagueOrgId.mockResolvedValue(ORG);
    mockResolveOrgRole.mockResolvedValue("admin");
    mockGetTeamsByLeague.mockResolvedValue([
      { id: "t1", name: "Alpha" },
      { id: "t2", name: "Beta" },
      { id: "t3", name: "Gamma" },
    ]);
    mockGetPlayers.mockResolvedValue([
      { id: "p1", teamId: "t1", status: "active" },
      { id: "p2", teamId: "t2", status: "active" },
      { id: "p3", teamId: "t3", status: "active" },
      ...Array.from({ length: 48 }, (_, index) => ({
        id: `full-${index}`,
        teamId: "t3",
        status: "active",
      })),
    ]);
    mockGetPlayersByTeam.mockImplementation(async (teamId: string) => {
      if (teamId === "t3") {
        return Array.from({ length: 48 }, (_, index) => ({
          id: `full-${index}`,
          jerseyNumber: index,
        }));
      }
      return [{ id: `player-${teamId}`, jerseyNumber: 1 }];
    });
    mockBulkCreatePlayers.mockResolvedValue({ created: 47 });
  });

  it("fills all deficient teams for admins", async () => {
    const res = await fillDeficientRostersAction({ leagueId: LEAGUE });
    expect(res).toEqual({
      ok: true,
      teamsFilled: 2,
      created: 94,
      fullTeamsUnchanged: 1,
    });
    expect(mockBulkCreatePlayers).toHaveBeenCalledTimes(2);
    expect(mockBulkCreatePlayers.mock.calls.map(([teamId]) => teamId)).toEqual([
      "t1",
      "t2",
    ]);
  });

  it("fills only managed deficient teams for coaches", async () => {
    mockResolveOrgRole.mockResolvedValue("coach");
    mockCanManageTeam.mockImplementation(async (teamId: string) => teamId === "t1");

    const res = await fillDeficientRostersAction({ leagueId: LEAGUE });
    expect(res).toEqual({
      ok: true,
      teamsFilled: 1,
      created: 47,
      fullTeamsUnchanged: 1,
    });
    expect(mockBulkCreatePlayers).toHaveBeenCalledTimes(1);
    expect(mockBulkCreatePlayers.mock.calls[0]?.[0]).toBe("t1");
  });

  it("rejects coaches who cannot manage any deficient team", async () => {
    mockResolveOrgRole.mockResolvedValue("coach");
    mockCanManageTeam.mockResolvedValue(false);

    expect(await fillDeficientRostersAction({ leagueId: LEAGUE })).toEqual({
      ok: false,
      error: "not_authorized",
    });
    expect(mockBulkCreatePlayers).not.toHaveBeenCalled();
  });

  it("rejects viewers", async () => {
    mockResolveOrgRole.mockResolvedValue("viewer");
    mockCanManageTeam.mockResolvedValue(false);

    expect(await fillDeficientRostersAction({ leagueId: LEAGUE })).toEqual({
      ok: false,
      error: "not_authorized",
    });
    expect(mockBulkCreatePlayers).not.toHaveBeenCalled();
  });

  it("leaves full team player IDs unchanged", async () => {
    await fillDeficientRostersAction({ leagueId: LEAGUE });
    const fullTeamCalls = mockGetPlayersByTeam.mock.calls.filter(
      ([teamId]) => teamId === "t3",
    );
    expect(fullTeamCalls.length).toBeGreaterThan(0);
    expect(mockBulkCreatePlayers.mock.calls.some(([teamId]) => teamId === "t3")).toBe(
      false,
    );
  });
});

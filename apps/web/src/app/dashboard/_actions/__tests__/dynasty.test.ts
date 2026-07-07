import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockAuth,
  mockResolveOrgContext,
  mockResolveOrgRole,
  mockGetLeagueOrgId,
  mockGetSeasons,
  mockListFixturesBySeason,
  mockGetPlayoffBracket,
  mockUpsertSeason,
  mockRollover,
  mockListSeasonPlayerAttributes,
  mockGetPlayers,
  mockIngestBatch,
  mockCopySeasonRosters,
  mockRemoveFromRoster,
  mockGetTeamsByLeague,
  mockGetPlayersByTeam,
  mockBulkCreatePlayers,
} = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockResolveOrgContext: vi.fn(),
  mockResolveOrgRole: vi.fn(),
  mockGetLeagueOrgId: vi.fn(),
  mockGetSeasons: vi.fn(),
  mockListFixturesBySeason: vi.fn(),
  mockGetPlayoffBracket: vi.fn(),
  mockUpsertSeason: vi.fn(),
  mockRollover: vi.fn(),
  mockListSeasonPlayerAttributes: vi.fn(),
  mockGetPlayers: vi.fn(),
  mockIngestBatch: vi.fn(),
  mockCopySeasonRosters: vi.fn(),
  mockRemoveFromRoster: vi.fn(),
  mockGetTeamsByLeague: vi.fn(),
  mockGetPlayersByTeam: vi.fn(),
  mockBulkCreatePlayers: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: mockAuth }));
vi.mock("@/lib/org-context", () => ({
  resolveOrgContext: mockResolveOrgContext,
  resolveOrgRole: mockResolveOrgRole,
}));
vi.mock("@/lib/data-api", () => ({
  getLeagueOrgId: mockGetLeagueOrgId,
  getSeasons: mockGetSeasons,
  listFixturesBySeason: mockListFixturesBySeason,
  getPlayoffBracket: mockGetPlayoffBracket,
  upsertSeason: mockUpsertSeason,
  rolloverGraduateAndAdvancePlayers: mockRollover,
  listSeasonPlayerAttributes: mockListSeasonPlayerAttributes,
  getPlayers: mockGetPlayers,
  ingestPlayerAttributesBatch: mockIngestBatch,
  copySeasonRosters: mockCopySeasonRosters,
  removePlayersFromSeasonRoster: mockRemoveFromRoster,
  getTeamsByLeague: mockGetTeamsByLeague,
  getPlayersByTeam: mockGetPlayersByTeam,
  bulkCreatePlayers: mockBulkCreatePlayers,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { startNextSeasonAction } from "../dynasty";

const LEAGUE = "league_1";
const ORG = "org_1";
const ACTIVE = {
  id: "season_active",
  name: "2026",
  leagueId: LEAGUE,
  startDate: "2026-09-01",
  endDate: null,
  status: "active",
  rosterLocked: false,
  playoffTeams: 8,
  playoffFormat: "single",
  divisionWinnersQualify: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ userId: "user_1" });
  mockResolveOrgContext.mockResolvedValue({ visibleLeagueIds: [LEAGUE], orgIds: [ORG] });
  mockGetLeagueOrgId.mockResolvedValue(ORG);
  mockResolveOrgRole.mockResolvedValue("admin");
  mockGetSeasons.mockResolvedValue([ACTIVE]);
  mockListFixturesBySeason.mockResolvedValue([
    {
      id: "f1",
      seasonId: ACTIVE.id,
      homeTeamId: "h",
      awayTeamId: "a",
      homeTeamName: "H",
      awayTeamName: "A",
      scheduledAt: null,
      week: 1,
      venue: null,
      status: "final",
      stage: "regular",
      createdAt: "",
      createdBy: "",
    },
  ]);
  mockGetPlayoffBracket.mockResolvedValue(null);
  mockUpsertSeason.mockResolvedValue({
    dto: { ...ACTIVE, id: "season_next", name: "2027", status: "upcoming" },
    created: true,
  });
  mockRollover.mockResolvedValue({
    graduatedPlayerIds: [],
    advancedPlayerIds: ["p1"],
  });
  mockListSeasonPlayerAttributes.mockResolvedValue([
    {
      playerId: "p1",
      positionGroup: "QB",
      attributes: { SPD: 70 },
      weightedOverall: 70,
    },
  ]);
  mockGetPlayers.mockResolvedValue([
    {
      id: "p1",
      name: "QB One",
      teamId: "team_1",
      position: "QB",
      positionGroup: null,
      jerseyNumber: 1,
      dateOfBirth: null,
      status: "Active",
      headshotUrl: null,
      experienceYears: 1,
      grade: 10,
      squad: "JV",
      hometown: null,
    },
  ]);
  mockIngestBatch.mockResolvedValue({ created: 1, updated: 0 });
  mockCopySeasonRosters.mockResolvedValue({
    copiedAssignments: 1,
    copiedDepthEntries: 1,
    sourceSeasonId: ACTIVE.id,
  });
  mockRemoveFromRoster.mockResolvedValue({
    removedAssignments: 0,
    removedDepthEntries: 0,
  });
  mockGetTeamsByLeague.mockResolvedValue([{ id: "team_1", name: "Eagles" }]);
  mockGetPlayersByTeam.mockResolvedValue([
    {
      id: "p1",
      name: "QB One",
      teamId: "team_1",
      position: "QB",
      positionGroup: null,
      jerseyNumber: 1,
      dateOfBirth: null,
      status: "Active",
      headshotUrl: null,
      experienceYears: 1,
      grade: 10,
      squad: "JV",
      hometown: null,
    },
  ]);
  mockBulkCreatePlayers.mockResolvedValue({ created: 47 });
});

describe("startNextSeasonAction preconditions", () => {
  it("returns no_season when no active season exists", async () => {
    mockGetSeasons.mockResolvedValue([
      { ...ACTIVE, id: "s2", status: "completed" },
    ]);
    expect(await startNextSeasonAction({ leagueId: LEAGUE })).toEqual({
      ok: false,
      error: "no_season",
    });
  });

  it("returns next_season_exists when an upcoming season already exists", async () => {
    mockGetSeasons.mockResolvedValue([
      ACTIVE,
      { ...ACTIVE, id: "s_up", status: "upcoming", name: "2027" },
    ]);
    expect(await startNextSeasonAction({ leagueId: LEAGUE })).toEqual({
      ok: false,
      error: "next_season_exists",
    });
  });

  it("returns season_not_decided when fixtures remain and no champion", async () => {
    mockListFixturesBySeason.mockResolvedValue([
      {
        id: "f1",
        seasonId: ACTIVE.id,
        homeTeamId: "h",
        awayTeamId: "a",
        homeTeamName: "H",
        awayTeamName: "A",
        scheduledAt: null,
        week: 1,
        venue: null,
        status: "scheduled",
        stage: "regular",
        createdAt: "",
        createdBy: "",
      },
    ]);
    expect(await startNextSeasonAction({ leagueId: LEAGUE })).toEqual({
      ok: false,
      error: "season_not_decided",
    });
  });

  it("returns season_not_decided when bracket exists without a champion", async () => {
    mockGetPlayoffBracket.mockResolvedValue({
      bracketId: "b1",
      size: 4,
      rounds: 2,
      format: "single",
      matchups: [
        {
          id: "m1",
          round: 2,
          slot: 1,
          homeSeed: 1,
          awaySeed: 2,
          homeTeamId: "h",
          awayTeamId: "a",
          homeTeamName: "H",
          awayTeamName: "A",
          homeScore: null,
          awayScore: null,
          winnerTeamId: null,
          fixtureId: null,
          bracketType: "winners",
          status: null,
          isBye: false,
          hasPlayLog: false,
        },
      ],
      champion: null,
    });
    mockListFixturesBySeason.mockResolvedValue([]);
    expect(await startNextSeasonAction({ leagueId: LEAGUE })).toEqual({
      ok: false,
      error: "season_not_decided",
    });
  });

  it("rejects non-admin callers", async () => {
    mockResolveOrgRole.mockResolvedValue("coach");
    expect(await startNextSeasonAction({ leagueId: LEAGUE })).toEqual({
      ok: false,
      error: "not_authorized",
    });
  });
});

describe("startNextSeasonAction success path", () => {
  it("orchestrates rollover steps and tops up freshmen", async () => {
    const res = await startNextSeasonAction({ leagueId: LEAGUE });
    expect(res).toMatchObject({
      ok: true,
      seasonId: "season_next",
      freshmen: 47,
    });
    expect(mockUpsertSeason).toHaveBeenCalledWith(
      expect.objectContaining({ status: "upcoming", name: "2027" }),
    );
    expect(mockRollover).toHaveBeenCalled();
    expect(mockIngestBatch).toHaveBeenCalled();
    expect(mockCopySeasonRosters).toHaveBeenCalledWith(
      expect.objectContaining({
        targetSeasonId: "season_next",
        sourceSeasonId: ACTIVE.id,
        confirm: true,
      }),
    );
    expect(mockBulkCreatePlayers).toHaveBeenCalledWith(
      "team_1",
      expect.arrayContaining([expect.objectContaining({ grade: 9 })]),
    );
  });

  it("routes freshmen to the free-agent pool when freshmenToPool is true", async () => {
    await startNextSeasonAction({ leagueId: LEAGUE, freshmenToPool: true });
    expect(mockBulkCreatePlayers).toHaveBeenCalledWith(
      "team_1",
      expect.arrayContaining([
        expect.objectContaining({ grade: 9, status: "free_agent" }),
      ]),
    );
  });

  it("auto-assigns freshmen with Active status by default", async () => {
    await startNextSeasonAction({ leagueId: LEAGUE });
    expect(mockBulkCreatePlayers).toHaveBeenCalledWith(
      "team_1",
      expect.arrayContaining([expect.objectContaining({ status: "Active" })]),
    );
  });
});

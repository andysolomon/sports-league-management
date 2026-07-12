import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockAuth,
  mockResolveOrgContext,
  mockResolveOrgRole,
  mockGetLeagueOrgId,
  mockGetSeasons,
  mockBeginSeasonRollover,
  mockAdvanceSeasonRollover,
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
  mockBeginSeasonRollover: vi.fn(),
  mockAdvanceSeasonRollover: vi.fn(),
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
  beginSeasonRollover: mockBeginSeasonRollover,
  advanceSeasonRollover: mockAdvanceSeasonRollover,
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
  status: "completed",
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
  mockBeginSeasonRollover.mockResolvedValue({
    rolloverId: "rollover_1",
    targetSeasonId: "season_next",
    resumed: false,
    stage: "target_created",
    status: "in_progress",
    graduatedPlayerIds: [],
    advancedPlayerIds: [],
  });
  mockAdvanceSeasonRollover.mockImplementation(({ stage }: { stage: string }) =>
    Promise.resolve({
      rolloverId: "rollover_1",
      targetSeasonId: "season_next",
      stage,
      status: stage === "completed" ? "completed" : "in_progress",
      graduatedPlayerIds: [],
      advancedPlayerIds: ["p1"],
    }),
  );
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
  it("requires a completed source season", async () => {
    mockGetSeasons.mockResolvedValue([{ ...ACTIVE, status: "active" }]);
    expect(await startNextSeasonAction({ leagueId: LEAGUE })).toEqual({
      ok: false,
      error: "no_completed_season",
    });
  });

  it("surfaces a conflicting upcoming target from the transactional claim", async () => {
    mockGetSeasons.mockResolvedValue([
      ACTIVE,
      { ...ACTIVE, id: "s_up", status: "upcoming", name: "2027" },
    ]);
    mockBeginSeasonRollover.mockRejectedValueOnce(new Error("next_season_exists"));
    expect(await startNextSeasonAction({ leagueId: LEAGUE })).toEqual({
      ok: false,
      error: "next_season_exists",
    });
  });

  it("chooses the newest completed source, not a still-active season", async () => {
    mockGetSeasons.mockResolvedValue([
      { ...ACTIVE, id: "old", name: "2025", startDate: "2025-09-01" },
      { ...ACTIVE, id: "newest", name: "2026", startDate: "2026-09-01" },
      { ...ACTIVE, id: "active", status: "active", startDate: "2027-09-01" },
    ]);
    await startNextSeasonAction({ leagueId: LEAGUE });
    expect(mockBeginSeasonRollover).toHaveBeenCalledWith({
      sourceSeasonId: "newest",
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
    expect(mockBeginSeasonRollover).toHaveBeenCalledWith({
      sourceSeasonId: ACTIVE.id,
    });
    expect(mockRollover).toHaveBeenCalled();
    expect(mockRollover).toHaveBeenCalledWith({
      leagueId: LEAGUE,
      seasonId: ACTIVE.id,
      rolloverId: "rollover_1",
    });
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

  it("resumes after player progression without repeating irreversible work", async () => {
    mockBeginSeasonRollover.mockResolvedValue({
      rolloverId: "rollover_1",
      targetSeasonId: "season_next",
      resumed: true,
      stage: "players_progressed",
      status: "in_progress",
      graduatedPlayerIds: [],
      advancedPlayerIds: ["p1"],
    });

    await startNextSeasonAction({ leagueId: LEAGUE });

    expect(mockRollover).not.toHaveBeenCalled();
    expect(mockAdvanceSeasonRollover).toHaveBeenCalledWith({
      rolloverId: "rollover_1",
      stage: "attributes_copied",
    });
  });

  it("returns a finalized claim without reopening a completed target", async () => {
    mockBeginSeasonRollover.mockResolvedValue({
      rolloverId: "rollover_1",
      targetSeasonId: "season_next",
      resumed: true,
      stage: "completed",
      status: "completed",
      graduatedPlayerIds: ["graduated"],
      advancedPlayerIds: ["p1"],
    });

    expect(await startNextSeasonAction({ leagueId: LEAGUE })).toEqual({
      ok: true,
      seasonId: "season_next",
      graduated: 1,
      advanced: 1,
      progressed: 0,
      freshmen: 0,
    });
    expect(mockRollover).not.toHaveBeenCalled();
    expect(mockCopySeasonRosters).not.toHaveBeenCalled();
  });
});

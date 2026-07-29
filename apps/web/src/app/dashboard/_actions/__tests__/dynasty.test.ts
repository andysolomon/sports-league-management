import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockAuth,
  mockResolveOrgContext,
  mockResolveOrgRole,
  mockGetLeagueOrgId,
  mockGetSeasons,
  mockBeginSeasonRollover,
  mockAdvanceSeasonRollover,
  mockClaimSeasonRolloverStage,
  mockReleaseSeasonRolloverStage,
  mockRollover,
  mockListSeasonPlayerAttributes,
  mockGetPlayers,
  mockIngestBatch,
  mockCopySeasonRosters,
  mockRemoveFromRoster,
  mockGetTeamsByLeague,
  mockGetPlayersByTeam,
  mockCreateRolloverFreshmenForTeam,
  mockHealSeasonInjuries,
  mockCreateProspectClass,
  mockGetDynastyConfig,
  mockListCoachesByLeague,
  mockInductHallOfFameClass,
} = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockResolveOrgContext: vi.fn(),
  mockResolveOrgRole: vi.fn(),
  mockGetLeagueOrgId: vi.fn(),
  mockGetSeasons: vi.fn(),
  mockBeginSeasonRollover: vi.fn(),
  mockAdvanceSeasonRollover: vi.fn(),
  mockClaimSeasonRolloverStage: vi.fn(),
  mockReleaseSeasonRolloverStage: vi.fn(),
  mockRollover: vi.fn(),
  mockListSeasonPlayerAttributes: vi.fn(),
  mockGetPlayers: vi.fn(),
  mockIngestBatch: vi.fn(),
  mockCopySeasonRosters: vi.fn(),
  mockRemoveFromRoster: vi.fn(),
  mockGetTeamsByLeague: vi.fn(),
  mockGetPlayersByTeam: vi.fn(),
  mockCreateRolloverFreshmenForTeam: vi.fn(),
  mockHealSeasonInjuries: vi.fn(),
  mockCreateProspectClass: vi.fn(),
  mockGetDynastyConfig: vi.fn(),
  mockListCoachesByLeague: vi.fn(),
  mockInductHallOfFameClass: vi.fn(),
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
  claimSeasonRolloverStage: mockClaimSeasonRolloverStage,
  releaseSeasonRolloverStage: mockReleaseSeasonRolloverStage,
  rolloverGraduateAndAdvancePlayers: mockRollover,
  listSeasonPlayerAttributes: mockListSeasonPlayerAttributes,
  getPlayers: mockGetPlayers,
  ingestPlayerAttributesBatch: mockIngestBatch,
  copySeasonRosters: mockCopySeasonRosters,
  removePlayersFromSeasonRoster: mockRemoveFromRoster,
  getTeamsByLeague: mockGetTeamsByLeague,
  getPlayersByTeam: mockGetPlayersByTeam,
  createRolloverFreshmenForTeam: mockCreateRolloverFreshmenForTeam,
  healSeasonInjuries: mockHealSeasonInjuries,
  createProspectClass: mockCreateProspectClass,
  getDynastyConfig: mockGetDynastyConfig,
  listCoachesByLeague: mockListCoachesByLeague,
  inductHallOfFameClass: mockInductHallOfFameClass,
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
  simulationFlavor: "balanced" as const,
};
const completedSummary = {
  sourceSeason: { id: ACTIVE.id, name: ACTIVE.name },
  targetSeason: { id: "season_next", name: "2027" },
  graduation: { players: 1 },
  advancement: { players: 1 },
  progression: { snapshots: 1 },
  carryover: {
    copiedAssignments: 1,
    copiedDepthEntries: 1,
    removedAssignments: 1,
    removedDepthEntries: 1,
  },
  recruiting: { freshmen: 47, toPool: false, prospects: 12 },
  healing: { injuries: 3 },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ userId: "user_1" });
  mockResolveOrgContext.mockResolvedValue({
    visibleLeagueIds: [LEAGUE],
    orgIds: [ORG],
  });
  mockGetLeagueOrgId.mockResolvedValue(ORG);
  mockResolveOrgRole.mockResolvedValue("admin");
  mockListCoachesByLeague.mockResolvedValue([]);
  mockInductHallOfFameClass.mockResolvedValue({
    classLabel: null,
    inducted: 0,
  });
  mockGetSeasons.mockResolvedValue([ACTIVE]);
  mockBeginSeasonRollover.mockResolvedValue({
    rolloverId: "rollover_1",
    sourceSeasonId: ACTIVE.id,
    sourceSeasonName: ACTIVE.name,
    targetSeasonId: "season_next",
    targetSeasonName: "2027",
    resumed: false,
    stage: "target_created",
    status: "in_progress",
    graduatedPlayerIds: [],
    advancedPlayerIds: [],
    summaryJson: null,
  });
  mockAdvanceSeasonRollover.mockImplementation(({ stage }: { stage: string }) =>
    Promise.resolve({
      rolloverId: "rollover_1",
      sourceSeasonId: ACTIVE.id,
      sourceSeasonName: ACTIVE.name,
      targetSeasonId: "season_next",
      targetSeasonName: "2027",
      stage,
      status: stage === "completed" ? "completed" : "in_progress",
      graduatedPlayerIds: [],
      advancedPlayerIds: ["p1"],
      summaryJson: null,
    }),
  );
  mockClaimSeasonRolloverStage.mockImplementation(
    ({ stage }: { stage: string }) =>
      Promise.resolve({
        acquired: true,
        reason: "acquired",
        rolloverId: "rollover_1",
        stage:
          stage === "players_progressed"
            ? "target_created"
            : stage === "attributes_copied"
              ? "players_progressed"
              : stage === "rosters_copied"
                ? "attributes_copied"
                : stage === "freshmen_created"
                  ? "rosters_copied"
                  : stage === "injuries_healed"
                    ? "freshmen_created"
                    : stage === "prospects_generated"
                      ? "injuries_healed"
                      : stage === "hall_of_fame_inducted"
                        ? "prospects_generated"
                        : "hall_of_fame_inducted",
        status: "in_progress",
        graduatedPlayerIds: [],
        advancedPlayerIds: ["p1"],
        summaryJson: null,
        freshmenProgressJson: null,
      }),
  );
  mockReleaseSeasonRolloverStage.mockResolvedValue(null);
  mockHealSeasonInjuries.mockResolvedValue({ healed: 0 });
  mockGetDynastyConfig.mockResolvedValue({ recruitingEnabled: true });
  mockCreateProspectClass.mockResolvedValue({
    created: 12,
    alreadyExisted: false,
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
  mockCreateRolloverFreshmenForTeam.mockResolvedValue({
    created: 47,
    totalCreated: 47,
    alreadyCompleted: false,
  });
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
    mockBeginSeasonRollover.mockRejectedValueOnce(
      new Error("next_season_exists"),
    );
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
      ownerId: expect.any(String),
    });
    expect(mockIngestBatch).toHaveBeenCalled();
    expect(mockCopySeasonRosters).toHaveBeenCalledWith(
      expect.objectContaining({
        targetSeasonId: "season_next",
        sourceSeasonId: ACTIVE.id,
        confirm: true,
      }),
    );
    expect(mockCreateRolloverFreshmenForTeam).toHaveBeenCalledWith(
      expect.objectContaining({
        teamId: "team_1",
        players: expect.arrayContaining([expect.objectContaining({ grade: 9 })]),
      }),
    );
    expect(mockAdvanceSeasonRollover).toHaveBeenLastCalledWith({
      rolloverId: "rollover_1",
      stage: "completed",
      summaryJson: expect.stringContaining('"freshmen":47'),
      ownerId: expect.any(String),
    });
  });

  it("routes freshmen to the free-agent pool when freshmenToPool is true", async () => {
    await startNextSeasonAction({ leagueId: LEAGUE, freshmenToPool: true });
    expect(mockCreateRolloverFreshmenForTeam).toHaveBeenCalledWith(
      expect.objectContaining({
        teamId: "team_1",
        players: expect.arrayContaining([
          expect.objectContaining({ grade: 9, status: "free_agent" }),
        ]),
      }),
    );
  });

  it("auto-assigns freshmen with Active status by default", async () => {
    await startNextSeasonAction({ leagueId: LEAGUE });
    expect(mockCreateRolloverFreshmenForTeam).toHaveBeenCalledWith(
      expect.objectContaining({
        teamId: "team_1",
        players: expect.arrayContaining([
          expect.objectContaining({ status: "Active" }),
        ]),
      }),
    );
  });

  it("resumes after player progression without repeating irreversible work", async () => {
    mockBeginSeasonRollover.mockResolvedValue({
      rolloverId: "rollover_1",
      sourceSeasonId: ACTIVE.id,
      sourceSeasonName: ACTIVE.name,
      targetSeasonId: "season_next",
      targetSeasonName: "2027",
      resumed: true,
      stage: "players_progressed",
      status: "in_progress",
      graduatedPlayerIds: [],
      advancedPlayerIds: ["p1"],
      summaryJson: null,
    });

    await startNextSeasonAction({ leagueId: LEAGUE });

    expect(mockRollover).not.toHaveBeenCalled();
    expect(mockAdvanceSeasonRollover).toHaveBeenCalledWith({
      rolloverId: "rollover_1",
      stage: "attributes_copied",
      summaryJson: expect.any(String),
      ownerId: expect.any(String),
    });
  });

  it("resumes after attributes are copied without rewriting progression", async () => {
    mockBeginSeasonRollover.mockResolvedValue({
      rolloverId: "rollover_1",
      sourceSeasonId: ACTIVE.id,
      sourceSeasonName: ACTIVE.name,
      targetSeasonId: "season_next",
      targetSeasonName: "2027",
      resumed: true,
      stage: "attributes_copied",
      status: "in_progress",
      graduatedPlayerIds: [],
      advancedPlayerIds: ["p1"],
      summaryJson: JSON.stringify({
        ...completedSummary,
        recruiting: { freshmen: 0, toPool: false },
      }),
    });

    await startNextSeasonAction({ leagueId: LEAGUE });

    expect(mockRollover).not.toHaveBeenCalled();
    expect(mockIngestBatch).not.toHaveBeenCalled();
    expect(mockCopySeasonRosters).toHaveBeenCalled();
  });

  it("resumes after rosters are copied without copying rosters again", async () => {
    mockBeginSeasonRollover.mockResolvedValue({
      rolloverId: "rollover_1",
      sourceSeasonId: ACTIVE.id,
      sourceSeasonName: ACTIVE.name,
      targetSeasonId: "season_next",
      targetSeasonName: "2027",
      resumed: true,
      stage: "rosters_copied",
      status: "in_progress",
      graduatedPlayerIds: [],
      advancedPlayerIds: ["p1"],
      summaryJson: JSON.stringify({
        ...completedSummary,
        recruiting: { freshmen: 0, toPool: false },
      }),
    });

    await startNextSeasonAction({ leagueId: LEAGUE });

    expect(mockCopySeasonRosters).not.toHaveBeenCalled();
    expect(mockCreateRolloverFreshmenForTeam).toHaveBeenCalled();
  });

  it("resumes partial freshman work from persisted team progress", async () => {
    mockBeginSeasonRollover.mockResolvedValue({
      rolloverId: "rollover_1",
      sourceSeasonId: ACTIVE.id,
      sourceSeasonName: ACTIVE.name,
      targetSeasonId: "season_next",
      targetSeasonName: "2027",
      resumed: true,
      stage: "rosters_copied",
      status: "in_progress",
      graduatedPlayerIds: [],
      advancedPlayerIds: ["p1"],
      summaryJson: JSON.stringify({
        ...completedSummary,
        recruiting: { freshmen: 0, toPool: false },
      }),
    });
    mockClaimSeasonRolloverStage.mockImplementation(
      ({ stage }: { stage: string }) =>
        Promise.resolve({
          acquired: true,
          reason: "acquired",
          rolloverId: "rollover_1",
          stage:
            stage === "freshmen_created"
              ? "rosters_copied"
              : stage === "completed"
                ? "freshmen_created"
                : stage,
          status: "in_progress",
          graduatedPlayerIds: [],
          advancedPlayerIds: ["p1"],
          summaryJson: null,
          freshmenProgressJson: JSON.stringify({ team_1: 12 }),
        }),
    );

    const res = await startNextSeasonAction({ leagueId: LEAGUE });

    expect(mockCreateRolloverFreshmenForTeam).not.toHaveBeenCalled();
    expect(res).toMatchObject({ ok: true, freshmen: 12 });
  });

  it("derives progressed from the refreshed summary when another worker finished attribute progression", async () => {
    // Begin already past player progression so only attributes_copied is contested.
    mockBeginSeasonRollover.mockResolvedValue({
      rolloverId: "rollover_1",
      sourceSeasonId: ACTIVE.id,
      sourceSeasonName: ACTIVE.name,
      targetSeasonId: "season_next",
      targetSeasonName: "2027",
      resumed: true,
      stage: "players_progressed",
      status: "in_progress",
      graduatedPlayerIds: [],
      advancedPlayerIds: ["p1"],
      summaryJson: JSON.stringify({
        ...completedSummary,
        progression: { snapshots: 0 },
        recruiting: { freshmen: 0, toPool: false },
      }),
    });
    mockClaimSeasonRolloverStage.mockImplementation(
      ({ stage }: { stage: string }) => {
        if (stage === "attributes_copied") {
          // Another worker already completed this stage: acquired:false with a
          // persisted summary that carries the truthful snapshot count.
          return Promise.resolve({
            acquired: false,
            reason: "already_completed",
            rolloverId: "rollover_1",
            stage: "attributes_copied",
            status: "in_progress",
            graduatedPlayerIds: [],
            advancedPlayerIds: ["p1"],
            summaryJson: JSON.stringify({
              ...completedSummary,
              progression: { snapshots: 99 },
              recruiting: { freshmen: 0, toPool: false },
            }),
            freshmenProgressJson: null,
          });
        }
        const predecessor =
          stage === "rosters_copied"
            ? "attributes_copied"
            : stage === "freshmen_created"
              ? "rosters_copied"
              : "freshmen_created";
        return Promise.resolve({
          acquired: true,
          reason: "acquired",
          rolloverId: "rollover_1",
          stage: predecessor,
          status: "in_progress",
          graduatedPlayerIds: [],
          advancedPlayerIds: ["p1"],
          summaryJson: null,
          freshmenProgressJson: null,
        });
      },
    );

    const res = await startNextSeasonAction({ leagueId: LEAGUE });

    // This worker never ran the ingest, yet the count is truthful from summary.
    expect(mockIngestBatch).not.toHaveBeenCalled();
    expect(res).toMatchObject({ ok: true, progressed: 99, freshmen: 47 });
  });

  it("derives freshmen from the refreshed summary when another worker finished recruiting", async () => {
    mockBeginSeasonRollover.mockResolvedValue({
      rolloverId: "rollover_1",
      sourceSeasonId: ACTIVE.id,
      sourceSeasonName: ACTIVE.name,
      targetSeasonId: "season_next",
      targetSeasonName: "2027",
      resumed: true,
      stage: "rosters_copied",
      status: "in_progress",
      graduatedPlayerIds: [],
      advancedPlayerIds: ["p1"],
      summaryJson: JSON.stringify({
        ...completedSummary,
        progression: { snapshots: 55 },
        recruiting: { freshmen: 0, toPool: false },
      }),
    });
    mockClaimSeasonRolloverStage.mockImplementation(
      ({ stage }: { stage: string }) => {
        if (stage === "freshmen_created") {
          return Promise.resolve({
            acquired: false,
            reason: "already_completed",
            rolloverId: "rollover_1",
            stage: "freshmen_created",
            status: "in_progress",
            graduatedPlayerIds: [],
            advancedPlayerIds: ["p1"],
            summaryJson: JSON.stringify({
              ...completedSummary,
              progression: { snapshots: 55 },
              recruiting: { freshmen: 88, toPool: false },
            }),
            freshmenProgressJson: null,
          });
        }
        return Promise.resolve({
          acquired: true,
          reason: "acquired",
          rolloverId: "rollover_1",
          stage: "freshmen_created",
          status: "in_progress",
          graduatedPlayerIds: [],
          advancedPlayerIds: ["p1"],
          summaryJson: null,
          freshmenProgressJson: null,
        });
      },
    );

    const res = await startNextSeasonAction({ leagueId: LEAGUE });

    expect(mockCreateRolloverFreshmenForTeam).not.toHaveBeenCalled();
    expect(res).toMatchObject({ ok: true, freshmen: 88, progressed: 55 });
  });

  it("returns a finalized claim with its persisted summary without reopening a completed target", async () => {
    mockBeginSeasonRollover.mockResolvedValue({
      rolloverId: "rollover_1",
      sourceSeasonId: ACTIVE.id,
      sourceSeasonName: ACTIVE.name,
      targetSeasonId: "season_next",
      targetSeasonName: "2027",
      resumed: true,
      stage: "completed",
      status: "completed",
      graduatedPlayerIds: ["graduated"],
      advancedPlayerIds: ["p1"],
      summaryJson: JSON.stringify(completedSummary),
    });

    expect(await startNextSeasonAction({ leagueId: LEAGUE })).toEqual({
      ok: true,
      seasonId: "season_next",
      seasonName: "2027",
      graduated: 1,
      advanced: 1,
      progressed: 1,
      freshmen: 47,
      summary: completedSummary,
    });
    expect(mockRollover).not.toHaveBeenCalled();
    expect(mockCopySeasonRosters).not.toHaveBeenCalled();
  });

  /*
   * Injury healing (B2, #620). The stage sits between freshmen and completion
   * and reaches BACK into the season being closed, which is what these assert:
   * the source season id, not the target's.
   */
  describe("injuries_healed stage", () => {
    it("heals the source season and records the count in the summary", async () => {
      mockHealSeasonInjuries.mockResolvedValue({ healed: 5 });

      const res = await startNextSeasonAction({ leagueId: LEAGUE });

      expect(mockHealSeasonInjuries).toHaveBeenCalledWith({
        // The season being CLOSED. Healing the target would clear injuries
        // that have not been sustained yet.
        seasonId: ACTIVE.id,
      });
      expect(mockAdvanceSeasonRollover).toHaveBeenCalledWith({
        rolloverId: "rollover_1",
        stage: "injuries_healed",
        summaryJson: expect.stringContaining('"injuries":5'),
        ownerId: expect.any(String),
      });
      expect(res).toMatchObject({ ok: true });
      expect((res as { summary: { healing: { injuries: number } } }).summary
        .healing.injuries).toBe(5);
    });

    it("still completes the rollover when healing fails", async () => {
      /*
       * The next season already exists by this point. Aborting here would
       * leave a league with a built roster and no completed rollover, which is
       * strictly worse than a season archived with a few injuries still open.
       */
      mockHealSeasonInjuries.mockRejectedValue(new Error("convex_down"));

      const res = await startNextSeasonAction({ leagueId: LEAGUE });

      expect(res).toMatchObject({ ok: true, seasonId: "season_next" });
      expect(mockAdvanceSeasonRollover).toHaveBeenLastCalledWith(
        expect.objectContaining({ stage: "completed" }),
      );
      expect(mockReleaseSeasonRolloverStage).not.toHaveBeenCalled();
    });

    it("does not re-heal a rollover resumed past the stage", async () => {
      mockBeginSeasonRollover.mockResolvedValue({
        rolloverId: "rollover_1",
        sourceSeasonId: ACTIVE.id,
        sourceSeasonName: ACTIVE.name,
        targetSeasonId: "season_next",
        targetSeasonName: "2027",
        resumed: true,
        stage: "injuries_healed",
        status: "in_progress",
        graduatedPlayerIds: [],
        advancedPlayerIds: ["p1"],
        summaryJson: JSON.stringify(completedSummary),
      });

      const res = await startNextSeasonAction({ leagueId: LEAGUE });

      expect(mockHealSeasonInjuries).not.toHaveBeenCalled();
      expect(res).toMatchObject({ ok: true });
    });
  });

  /*
   * Recruiting class generation (B3, #621). The stage runs after the backfill
   * has filled every roster — the class is talent on top of a playable floor,
   * not a replacement for one.
   */
  describe("prospects_generated stage", () => {
    it("builds a class for the TARGET season and records the count", async () => {
      const res = await startNextSeasonAction({ leagueId: LEAGUE });

      expect(mockCreateProspectClass).toHaveBeenCalledWith(
        expect.objectContaining({
          leagueId: LEAGUE,
          // The season being BUILT. A class on the closing season would be
          // recruits for a year that has already been played.
          seasonId: "season_next",
        }),
      );
      const call = mockCreateProspectClass.mock.calls[0]?.[0] as {
        prospects: Array<{ trueAttributesJson: string; potentialTier: string }>;
      };
      expect(call.prospects.length).toBeGreaterThan(0);
      // Truth is generated on this side and handed over once. If a prospect
      // arrived without it there would be nothing for scouting to blur.
      expect(call.prospects[0].trueAttributesJson).toContain("SPD");
      expect(call.prospects[0].potentialTier.length).toBeGreaterThan(0);
      expect(res).toMatchObject({ ok: true });
    });

    it("still fills rosters when recruiting is switched off", async () => {
      /*
       * The kill switch removes a MECHANIC, not the players. A league with
       * recruiting off must still get a full roster out of the rollover, or
       * the switch would be a way to break a season rather than to simplify
       * one.
       */
      mockGetDynastyConfig.mockResolvedValue({ recruitingEnabled: false });

      const res = await startNextSeasonAction({ leagueId: LEAGUE });

      expect(mockCreateProspectClass).not.toHaveBeenCalled();
      expect(mockCreateRolloverFreshmenForTeam).toHaveBeenCalled();
      expect(res).toMatchObject({ ok: true, seasonId: "season_next" });
    });

    it("still completes the rollover when class generation fails", async () => {
      // Same posture as healing: the next season already exists, and a league
      // with no board beats a rollover stuck short of `completed`.
      mockCreateProspectClass.mockRejectedValue(new Error("convex_down"));

      const res = await startNextSeasonAction({ leagueId: LEAGUE });

      expect(res).toMatchObject({ ok: true, seasonId: "season_next" });
      expect(mockAdvanceSeasonRollover).toHaveBeenLastCalledWith(
        expect.objectContaining({ stage: "completed" }),
      );
    });

    it("does not rebuild the class on a rollover resumed past the stage", async () => {
      mockBeginSeasonRollover.mockResolvedValue({
        rolloverId: "rollover_1",
        sourceSeasonId: ACTIVE.id,
        sourceSeasonName: ACTIVE.name,
        targetSeasonId: "season_next",
        targetSeasonName: "2027",
        resumed: true,
        stage: "prospects_generated",
        status: "in_progress",
        graduatedPlayerIds: [],
        advancedPlayerIds: ["p1"],
        summaryJson: JSON.stringify(completedSummary),
      });

      const res = await startNextSeasonAction({ leagueId: LEAGUE });

      expect(mockCreateProspectClass).not.toHaveBeenCalled();
      expect(res).toMatchObject({ ok: true });
    });
  });

  describe("hall_of_fame_inducted stage", () => {
    it("inducts against the completed source season before checkpointing", async () => {
      const res = await startNextSeasonAction({ leagueId: LEAGUE });

      expect(mockInductHallOfFameClass).toHaveBeenCalledWith({
        leagueId: LEAGUE,
        inductedSeasonId: ACTIVE.id,
      });
      expect(mockAdvanceSeasonRollover).toHaveBeenCalledWith({
        rolloverId: "rollover_1",
        stage: "hall_of_fame_inducted",
        summaryJson: expect.any(String),
        ownerId: expect.any(String),
      });
      expect(res).toMatchObject({ ok: true });
    });
  });
});

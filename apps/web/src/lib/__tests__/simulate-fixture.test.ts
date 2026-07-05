import { describe, it, expect, vi, beforeEach } from "vitest";
import { seedFromString } from "@/lib/simulate-game";
import { deriveStatLines, simulateGameLog } from "@/lib/pbp";
import type { TeamSimProfile } from "@/lib/pbp";

const {
  mockRecordGameResult,
  mockUpsertGamePlayLog,
  mockUpsertPlayerGameStats,
  mockBulkUpsertPlayerGameStats,
  mockBuildTeamSimProfile,
} = vi.hoisted(() => ({
  mockRecordGameResult: vi.fn(),
  mockUpsertGamePlayLog: vi.fn(),
  mockUpsertPlayerGameStats: vi.fn(),
  mockBulkUpsertPlayerGameStats: vi.fn(),
  mockBuildTeamSimProfile: vi.fn(),
}));

vi.mock("@/lib/data-api", () => ({
  recordGameResult: mockRecordGameResult,
  upsertGamePlayLog: mockUpsertGamePlayLog,
  upsertPlayerGameStats: mockUpsertPlayerGameStats,
  bulkUpsertPlayerGameStats: mockBulkUpsertPlayerGameStats,
}));
vi.mock("@/lib/build-team-sim-profile", () => ({
  buildTeamSimProfile: mockBuildTeamSimProfile,
}));

import { simulateAndPersistFixture } from "../simulate-fixture";
import type { OrgContext } from "@/lib/org-context";

const FIX = "fixture_abc";
const SEASON = "season_1";
const USER = "user_1";
const LEAGUE = "league_1";

const ORG_CONTEXT: OrgContext = {
  userId: USER,
  orgIds: ["org_1"],
  visibleLeagueIds: [LEAGUE],
  subscribedLeagueIds: [LEAGUE],
  subscriptionTeamScopes: {},
};

const FIXTURE = {
  id: FIX,
  seasonId: SEASON,
  homeTeamId: "team_home",
  awayTeamId: "team_away",
  homeTeamName: "Home",
  awayTeamName: "Away",
  scheduledAt: null,
  week: 1,
  venue: null,
  status: "scheduled" as const,
  stage: "regular",
  createdAt: "2026-01-01T00:00:00.000Z",
  createdBy: USER,
};

function sampleTeam(teamId: string, playerIds: string[]): TeamSimProfile {
  return {
    teamId,
    strength: 72,
    players: playerIds.map((id, i) => ({
      playerId: id,
      position: i === 0 ? "QB" : "WR",
      overall: 70 + i,
      positionSlot: i === 0 ? "QB" : "WR",
      depthRank: i + 1,
    })),
  };
}

describe("simulateAndPersistFixture", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("persists log, bulk stat lines, and a matching score", async () => {
    const home = sampleTeam("team_home", ["p_home_qb", "p_home_wr"]);
    const away = sampleTeam("team_away", ["p_away_qb", "p_away_wr"]);
    mockBuildTeamSimProfile.mockImplementation(async (teamId: string) =>
      teamId === "team_home" ? home : away,
    );
    mockUpsertGamePlayLog.mockResolvedValue({ id: "log_1" });
    mockBulkUpsertPlayerGameStats.mockResolvedValue({ upserted: 4 });
    mockRecordGameResult.mockResolvedValue({ id: "gr_1" });

    const log = simulateGameLog({
      home,
      away,
      seed: seedFromString(FIX),
      decisive: false,
    });

    const res = await simulateAndPersistFixture({
      fixture: FIXTURE,
      orgContext: ORG_CONTEXT,
      actorUserId: USER,
      profileCache: new Map(),
      bulkStats: true,
    });

    expect(res.usedScoreFallback).toBe(false);
    expect(res.homeScore).toBe(log.homeScore);
    expect(res.awayScore).toBe(log.awayScore);
    expect(mockUpsertGamePlayLog).toHaveBeenCalledWith(
      expect.objectContaining({
        fixtureId: FIX,
        seasonId: SEASON,
        actorUserId: USER,
      }),
    );
    expect(mockRecordGameResult).toHaveBeenCalledWith({
      fixtureId: FIX,
      homeScore: log.homeScore,
      awayScore: log.awayScore,
      actorUserId: USER,
    });
    const lines = deriveStatLines(log).filter((l) =>
      ["p_home_qb", "p_home_wr", "p_away_qb", "p_away_wr"].includes(l.playerId),
    );
    expect(mockBulkUpsertPlayerGameStats).toHaveBeenCalledWith({
      fixtureId: FIX,
      seasonId: SEASON,
      actorUserId: USER,
      lines: expect.arrayContaining(
        lines.map((l) => ({
          playerId: l.playerId,
          teamId: l.teamId,
          statsJson: JSON.stringify(l.statLine),
        })),
      ),
    });
  });

  it("is deterministic for the same fixture seed", async () => {
    const home = sampleTeam("team_home", ["p1", "p2", "p3"]);
    const away = sampleTeam("team_away", ["p4", "p5", "p6"]);
    mockBuildTeamSimProfile.mockImplementation(async (teamId: string) =>
      teamId === "team_home" ? home : away,
    );
    mockUpsertGamePlayLog.mockResolvedValue({ id: "log_1" });
    mockRecordGameResult.mockResolvedValue({ id: "gr_1" });

    const calls: string[] = [];
    mockUpsertPlayerGameStats.mockImplementation(async (input) => {
      calls.push(JSON.stringify(input.stats));
      return { id: "pgs_1" };
    });

    await simulateAndPersistFixture({
      fixture: FIXTURE,
      orgContext: ORG_CONTEXT,
      actorUserId: USER,
      profileCache: new Map(),
    });
    const first = [...calls].sort();

    calls.length = 0;
    await simulateAndPersistFixture({
      fixture: FIXTURE,
      orgContext: ORG_CONTEXT,
      actorUserId: USER,
      profileCache: new Map(),
    });
    const second = [...calls].sort();

    expect(first).toEqual(second);
    expect(first.length).toBeGreaterThan(0);
  });

  it("falls back to score-only when a team has an empty roster", async () => {
    mockBuildTeamSimProfile.mockImplementation(async (teamId: string) =>
      teamId === "team_home"
        ? sampleTeam("team_home", ["p1"])
        : { teamId: "team_away", strength: 60, players: [] },
    );
    mockRecordGameResult.mockResolvedValue({ id: "gr_1" });

    const res = await simulateAndPersistFixture({
      fixture: FIXTURE,
      orgContext: ORG_CONTEXT,
      actorUserId: USER,
      profileCache: new Map(),
    });

    expect(res.usedScoreFallback).toBe(true);
    expect(mockUpsertGamePlayLog).not.toHaveBeenCalled();
    expect(mockUpsertPlayerGameStats).not.toHaveBeenCalled();
    expect(mockBulkUpsertPlayerGameStats).not.toHaveBeenCalled();
    expect(mockRecordGameResult).toHaveBeenCalledWith(
      expect.objectContaining({ fixtureId: FIX }),
    );
  });
});

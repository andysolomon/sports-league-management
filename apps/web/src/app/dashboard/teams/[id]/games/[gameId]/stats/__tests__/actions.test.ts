import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PlayerGameStatLine } from "@sports-management/shared-types";

const {
  mockStatKeepingV1,
  mockAuth,
  mockGetFixture,
  mockUpsert,
  mockDelete,
  mockCanManageTeam,
} = vi.hoisted(() => ({
  mockStatKeepingV1: vi.fn(),
  mockAuth: vi.fn(),
  mockGetFixture: vi.fn(),
  mockUpsert: vi.fn(),
  mockDelete: vi.fn(),
  mockCanManageTeam: vi.fn(),
}));

vi.mock("@/lib/flags", () => ({ statKeepingV1: mockStatKeepingV1 }));
vi.mock("@clerk/nextjs/server", () => ({ auth: mockAuth }));
vi.mock("@/lib/data-api", () => ({
  getFixture: mockGetFixture,
  upsertPlayerGameStats: mockUpsert,
  deletePlayerGameStats: mockDelete,
}));
vi.mock("@/lib/authorization", () => ({ canManageTeam: mockCanManageTeam }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { savePlayerGameStatsAction } from "../actions";

const TEAM = "team_home";
const FIX = "fixture_1";

function happy() {
  mockStatKeepingV1.mockResolvedValue(true);
  mockAuth.mockResolvedValue({ userId: "user_1" });
  mockGetFixture.mockResolvedValue({
    id: FIX,
    seasonId: "season_1",
    homeTeamId: TEAM,
    awayTeamId: "team_away",
  });
  mockCanManageTeam.mockResolvedValue(true);
  mockUpsert.mockResolvedValue({ id: "pgs_1" });
}

const validStats = { passing: { comp: 18, att: 27, yards: 243, td: 3, int: 1 } };

describe("savePlayerGameStatsAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    happy();
  });

  const call = (stats: unknown = validStats) =>
    savePlayerGameStatsAction({
      teamId: TEAM,
      fixtureId: FIX,
      playerId: "player_1",
      stats: stats as PlayerGameStatLine,
    });

  it("blocks when the flag is off", async () => {
    mockStatKeepingV1.mockResolvedValue(false);
    expect(await call()).toEqual({ ok: false, error: "flag_disabled" });
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("blocks an unauthenticated caller", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    expect(await call()).toEqual({ ok: false, error: "unauthorized" });
  });

  it("404s a fixture that doesn't exist", async () => {
    mockGetFixture.mockResolvedValue(null);
    expect(await call()).toEqual({ ok: false, error: "fixture_not_found" });
  });

  it("rejects a team not in the fixture (cross-fixture guard)", async () => {
    mockGetFixture.mockResolvedValue({
      id: FIX,
      seasonId: "season_1",
      homeTeamId: "other_a",
      awayTeamId: "other_b",
    });
    expect(await call()).toEqual({ ok: false, error: "team_not_in_fixture" });
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("rejects a caller who can't manage the team", async () => {
    mockCanManageTeam.mockResolvedValue(false);
    expect(await call()).toEqual({ ok: false, error: "not_authorized" });
  });

  it("rejects an invalid stat line (negative count)", async () => {
    const res = await call({ rushing: { carries: -3 } });
    expect(res.ok).toBe(false);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("persists a valid line with the fixture's season + actor", async () => {
    const res = await call();
    expect(res).toEqual({ ok: true });
    expect(mockUpsert).toHaveBeenCalledWith({
      fixtureId: FIX,
      playerId: "player_1",
      teamId: TEAM,
      seasonId: "season_1",
      stats: validStats,
      actorUserId: "user_1",
    });
  });
});

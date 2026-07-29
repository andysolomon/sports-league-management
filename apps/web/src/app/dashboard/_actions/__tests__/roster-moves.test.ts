import { describe, it, expect, beforeEach, vi } from "vitest";

const {
  mockAuth,
  mockCanAdminOrManageTeam,
  mockGetTeamLeagueId,
  mockSetPlayerSquad,
  mockChangePlayerPosition,
  mockRevalidatePath,
} = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockCanAdminOrManageTeam: vi.fn(),
  mockGetTeamLeagueId: vi.fn(),
  mockSetPlayerSquad: vi.fn(),
  mockChangePlayerPosition: vi.fn(),
  mockRevalidatePath: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: mockAuth }));
vi.mock("@/lib/authorization", () => ({
  canAdminOrManageTeam: mockCanAdminOrManageTeam,
}));
vi.mock("@/lib/data-api", () => ({
  getTeamLeagueId: mockGetTeamLeagueId,
  setPlayerSquad: mockSetPlayerSquad,
  changePlayerPosition: mockChangePlayerPosition,
}));
vi.mock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));

import {
  changePlayerPositionAction,
  setPlayerSquadAction,
} from "../roster-moves";

const TEAM_A = "team_a";
const TEAM_B = "team_b";
const SEASON = "season_1";
const PLAYER = "player_1";

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ userId: "coach_a" });
  mockGetTeamLeagueId.mockResolvedValue("league_1");
  mockCanAdminOrManageTeam.mockImplementation(
    async (teamId: string) => teamId === TEAM_A,
  );
  mockSetPlayerSquad.mockResolvedValue({ squad: "Varsity", changed: true });
  mockChangePlayerPosition.mockResolvedValue({
    position: "CB",
    positionGroup: "DB",
    changed: true,
  });
});

/*
 * Both actions gate on `teamId` (B5), the shape recruiting and transfers
 * already use. In Wave 5 the identical action serves a coach who owns exactly
 * one team; one written against "is org admin" could not be narrowed without
 * rewriting every call site.
 */
describe("setPlayerSquadAction", () => {
  it("lets a coach promote on the team they manage", async () => {
    const result = await setPlayerSquadAction({
      playerId: PLAYER,
      teamId: TEAM_A,
      seasonId: SEASON,
      squad: "Varsity",
    });
    expect(result).toEqual({
      ok: true,
      data: { squad: "Varsity", changed: true },
    });
    expect(mockSetPlayerSquad).toHaveBeenCalledWith(
      expect.objectContaining({ teamId: TEAM_A, actorUserId: "coach_a" }),
    );
  });

  it("refuses a coach of team A acting on team B", async () => {
    const result = await setPlayerSquadAction({
      playerId: PLAYER,
      teamId: TEAM_B,
      seasonId: SEASON,
      squad: "Varsity",
    });
    expect(result).toEqual({ ok: false, error: "not_authorized" });
    // Refused BEFORE the mutation — a gate that only rejected at the database
    // would already have read and locked the row.
    expect(mockSetPlayerSquad).not.toHaveBeenCalled();
  });

  it("refuses an unauthenticated caller before touching anything", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const result = await setPlayerSquadAction({
      playerId: PLAYER,
      teamId: TEAM_A,
      seasonId: SEASON,
      squad: "Varsity",
    });
    expect(result).toEqual({ ok: false, error: "unauthorized" });
    expect(mockCanAdminOrManageTeam).not.toHaveBeenCalled();
  });

  it("surfaces the bare reason a Convex error wraps", async () => {
    mockSetPlayerSquad.mockRejectedValue(
      new Error("[Request ID: abc] Server Error: grade_too_low_for_varsity"),
    );
    const result = await setPlayerSquadAction({
      playerId: PLAYER,
      teamId: TEAM_A,
      seasonId: SEASON,
      squad: "Varsity",
    });
    expect(result).toEqual({ ok: false, error: "grade_too_low_for_varsity" });
  });
});

describe("changePlayerPositionAction", () => {
  it("lets a coach convert a player on their own team", async () => {
    const result = await changePlayerPositionAction({
      playerId: PLAYER,
      teamId: TEAM_A,
      seasonId: SEASON,
      position: "CB",
    });
    expect(result.ok).toBe(true);
  });

  it("refuses a coach acting for another program", async () => {
    const result = await changePlayerPositionAction({
      playerId: PLAYER,
      teamId: TEAM_B,
      seasonId: SEASON,
      position: "CB",
    });
    expect(result).toEqual({ ok: false, error: "not_authorized" });
    expect(mockChangePlayerPosition).not.toHaveBeenCalled();
  });

  it("revalidates the depth chart, not only the team page", async () => {
    /*
     * A position change rewrites the depth chart. Leaving that page cached
     * would have it assert the old position until something unrelated evicted
     * it — the same staleness B4 fixed for the losing program's league page.
     */
    await changePlayerPositionAction({
      playerId: PLAYER,
      teamId: TEAM_A,
      seasonId: SEASON,
      position: "CB",
    });
    const paths = mockRevalidatePath.mock.calls.map((call) => call[0]);
    expect(paths).toContain(`/dashboard/teams/${TEAM_A}/depth-chart`);
    expect(paths).toContain(`/dashboard/seasons/${SEASON}/offseason`);
    expect(paths).toContain(`/dashboard/players/${PLAYER}`);
  });

  it("passes an unrecognised failure through rather than inventing one", async () => {
    mockChangePlayerPosition.mockRejectedValue(new Error("network exploded"));
    const result = await changePlayerPositionAction({
      playerId: PLAYER,
      teamId: TEAM_A,
      seasonId: SEASON,
      position: "CB",
    });
    expect(result).toEqual({ ok: false, error: "network exploded" });
  });
});

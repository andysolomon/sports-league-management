import { describe, it, expect, beforeEach, vi } from "vitest";

const {
  mockAuth,
  mockCanAdminOrManageTeam,
  mockGetTeamLeagueId,
  mockAllocateTraining,
  mockRevalidatePath,
} = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockCanAdminOrManageTeam: vi.fn(),
  mockGetTeamLeagueId: vi.fn(),
  mockAllocateTraining: vi.fn(),
  mockRevalidatePath: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: mockAuth }));
vi.mock("@/lib/authorization", () => ({
  canAdminOrManageTeam: mockCanAdminOrManageTeam,
}));
vi.mock("@/lib/data-api", () => ({
  getTeamLeagueId: mockGetTeamLeagueId,
  allocateTraining: mockAllocateTraining,
}));
vi.mock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));

import { allocateTrainingAction } from "../training";

const TEAM_A = "team_a";
const TEAM_B = "team_b";
const SEASON = "season_1";
const PLAYER = "player_1";

const INPUT = {
  playerId: PLAYER,
  teamId: TEAM_A,
  seasonId: SEASON,
  focus: "athleticism",
  points: 5,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ userId: "coach_a" });
  mockGetTeamLeagueId.mockResolvedValue("league_1");
  mockCanAdminOrManageTeam.mockImplementation(
    async (teamId: string) => teamId === TEAM_A,
  );
  mockAllocateTraining.mockResolvedValue({
    allocation: {
      id: "alloc_1",
      seasonId: SEASON,
      teamId: TEAM_A,
      playerId: PLAYER,
      focus: "athleticism",
      points: 5,
      appliedAt: null,
      appliedGainJson: null,
      createdAt: "2028-01-01T00:00:00.000Z",
    },
    pointsSpent: 5,
    pointsTotal: 100,
  });
});

/*
 * Training gates on `teamId` (B6), the shape recruiting, transfers and roster
 * moves already use. In Wave 5 the identical action serves a coach who owns one
 * team; one written against "is org admin" could not be narrowed without
 * rewriting every call site.
 */
describe("allocateTrainingAction", () => {
  it("records training for a team the caller manages", async () => {
    const result = await allocateTrainingAction(INPUT);
    expect(result).toEqual({
      ok: true,
      data: expect.objectContaining({ pointsSpent: 5, pointsTotal: 100 }),
    });
    expect(mockAllocateTraining).toHaveBeenCalledWith(
      expect.objectContaining({ teamId: TEAM_A, actorUserId: "coach_a" }),
    );
  });

  it("refuses a team the caller does not manage", async () => {
    const result = await allocateTrainingAction({ ...INPUT, teamId: TEAM_B });
    expect(result).toEqual({ ok: false, error: "not_authorized" });
    expect(mockAllocateTraining).not.toHaveBeenCalled();
  });

  it("refuses a signed-out caller before it reaches authorization", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const result = await allocateTrainingAction(INPUT);
    expect(result).toEqual({ ok: false, error: "unauthorized" });
    expect(mockCanAdminOrManageTeam).not.toHaveBeenCalled();
  });

  it("recovers the bare reason from a Convex-wrapped error", async () => {
    // Convex wraps a thrown Error in its own message, so the code the panel
    // switches on has to be found in the text.
    mockAllocateTraining.mockRejectedValue(
      new Error(
        "[CONVEX M(dynasty:allocateTraining)] Uncaught Error: training_budget_exhausted",
      ),
    );
    const result = await allocateTrainingAction(INPUT);
    expect(result).toEqual({ ok: false, error: "training_budget_exhausted" });
  });

  it("revalidates the hub, where an allocation is visible", async () => {
    await allocateTrainingAction(INPUT);
    expect(mockRevalidatePath).toHaveBeenCalledWith(
      `/dashboard/seasons/${SEASON}/offseason`,
    );
  });

  it("leaves the roster and player pages alone — nothing has changed there yet", async () => {
    /*
     * An allocation is a plan. The team, roster and player pages still show
     * what the player IS until the phase advance applies it, and revalidating
     * them would suggest a rating moved when none did.
     */
    await allocateTrainingAction(INPUT);
    const paths = mockRevalidatePath.mock.calls.map(([path]) => path);
    expect(paths).not.toContain(`/dashboard/teams/${TEAM_A}/roster`);
    expect(paths).not.toContain(`/dashboard/players/${PLAYER}`);
  });
});

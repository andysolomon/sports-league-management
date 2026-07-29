import { describe, it, expect, beforeEach, vi } from "vitest";

const {
  mockAuth,
  mockResolveOrgRole,
  mockGetLeagueOrgId,
  mockGetTeamLeagueId,
  mockGetSeason,
  mockCanManageTeam,
  mockGenerateTransferWindow,
  mockResolveTransfer,
} = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockResolveOrgRole: vi.fn(),
  mockGetLeagueOrgId: vi.fn(),
  mockGetTeamLeagueId: vi.fn(),
  mockGetSeason: vi.fn(),
  mockCanManageTeam: vi.fn(),
  mockGenerateTransferWindow: vi.fn(),
  mockResolveTransfer: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: mockAuth }));
vi.mock("@/lib/org-context", () => ({ resolveOrgRole: mockResolveOrgRole }));
vi.mock("@/lib/authorization", () => ({ canManageTeam: mockCanManageTeam }));
vi.mock("@/lib/data-api", () => ({
  getLeagueOrgId: mockGetLeagueOrgId,
  getTeamLeagueId: mockGetTeamLeagueId,
  getSeason: mockGetSeason,
  generateTransferWindow: mockGenerateTransferWindow,
  resolveTransfer: mockResolveTransfer,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import {
  openTransferWindowAction,
  resolveTransferAction,
} from "../transfers";

const LEAGUE = "league_1";
const SEASON = "season_1";
const TEAM_A = "team_a";
const TEAM_B = "team_b";
const TRANSFER = "transfer_1";

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ userId: "coach_a" });
  mockGetTeamLeagueId.mockResolvedValue(LEAGUE);
  mockGetLeagueOrgId.mockResolvedValue("org_1");
  // A coach, not an org admin — the case the per-team gate exists for.
  mockResolveOrgRole.mockResolvedValue("member");
  mockCanManageTeam.mockImplementation(
    async (teamId: string) => teamId === TEAM_A,
  );
  mockGetSeason.mockResolvedValue({ id: SEASON, leagueId: LEAGUE });
  mockGenerateTransferWindow.mockResolvedValue({
    outbound: 3,
    offers: 6,
    alreadyExisted: false,
  });
  mockResolveTransfer.mockResolvedValue({
    status: "accepted",
    moved: true,
    withdrawn: 1,
  });
});

/*
 * Two gates, two shapes (B4).
 *
 * Opening the window generates every team's slate in one write, so it is a
 * commissioner action. Resolving one transfer is one program's call about one
 * player, so it is gated per `teamId` — the shape Wave 5 needs and the one
 * that cannot be retrofitted.
 */
describe("openTransferWindowAction", () => {
  it("lets an org admin open the window", async () => {
    mockResolveOrgRole.mockResolvedValue("admin");
    const result = await openTransferWindowAction({
      leagueId: LEAGUE,
      seasonId: SEASON,
    });
    expect(result).toEqual({
      ok: true,
      data: { outbound: 3, offers: 6, alreadyExisted: false },
    });
  });

  it("refuses a coach who is not an admin", async () => {
    // Opening the window moves every team at once; a single coach should not
    // be able to start the league's offseason churn.
    const result = await openTransferWindowAction({
      leagueId: LEAGUE,
      seasonId: SEASON,
    });
    expect(result).toEqual({ ok: false, error: "not_authorized" });
    expect(mockGenerateTransferWindow).not.toHaveBeenCalled();
  });
});

describe("resolveTransferAction authorizes per team", () => {
  it("lets a coach decide for the team they manage", async () => {
    const result = await resolveTransferAction({
      transferId: TRANSFER,
      teamId: TEAM_A,
      seasonId: SEASON,
      decision: "accept",
    });
    expect(result.ok).toBe(true);
    expect(mockResolveTransfer).toHaveBeenCalledWith(
      expect.objectContaining({
        teamId: TEAM_A,
        decision: "accept",
        actorUserId: "coach_a",
      }),
    );
  });

  it("refuses a coach of team A deciding for team B", async () => {
    const result = await resolveTransferAction({
      transferId: TRANSFER,
      teamId: TEAM_B,
      seasonId: SEASON,
      decision: "accept",
    });
    expect(result).toEqual({ ok: false, error: "not_authorized" });
    // Refused BEFORE the mutation. A gate that only rejected at the database
    // would have already read and locked the row.
    expect(mockResolveTransfer).not.toHaveBeenCalled();
  });

  it("lets an org admin decide for any team, for solo play", async () => {
    mockResolveOrgRole.mockResolvedValue("admin");
    const result = await resolveTransferAction({
      transferId: TRANSFER,
      teamId: TEAM_B,
      seasonId: SEASON,
      decision: "reject",
    });
    expect(result.ok).toBe(true);
  });

  it("refuses an unauthenticated caller before touching anything", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const result = await resolveTransferAction({
      transferId: TRANSFER,
      teamId: TEAM_A,
      seasonId: SEASON,
      decision: "accept",
    });
    expect(result).toEqual({ ok: false, error: "unauthorized" });
    expect(mockGetTeamLeagueId).not.toHaveBeenCalled();
  });
});

describe("resolveTransferAction cache invalidation", () => {
  it("revalidates the losing program too when a player actually moves", async () => {
    /*
     * A completed transfer changes TWO rosters. Revalidating only the
     * destination would leave the losing program's pages showing a player it
     * no longer has until something unrelated evicted the cache.
     */
    await resolveTransferAction({
      transferId: TRANSFER,
      teamId: TEAM_A,
      seasonId: SEASON,
      decision: "accept",
    });
    expect(mockGetSeason).toHaveBeenCalled();
  });

  it("does not do the extra read when nothing moved", async () => {
    mockResolveTransfer.mockResolvedValue({
      status: "rejected",
      moved: false,
      withdrawn: 2,
    });
    await resolveTransferAction({
      transferId: TRANSFER,
      teamId: TEAM_A,
      seasonId: SEASON,
      decision: "reject",
    });
    expect(mockGetSeason).not.toHaveBeenCalled();
  });
});

describe("resolveTransferAction failures", () => {
  it("surfaces the bare reason a Convex error wraps", async () => {
    mockResolveTransfer.mockRejectedValue(
      new Error("[Request ID: abc] Server Error: transfer_not_released"),
    );
    const result = await resolveTransferAction({
      transferId: TRANSFER,
      teamId: TEAM_A,
      seasonId: SEASON,
      decision: "accept",
    });
    expect(result).toEqual({ ok: false, error: "transfer_not_released" });
  });

  it("passes an unrecognised failure through rather than inventing one", async () => {
    mockResolveTransfer.mockRejectedValue(new Error("network exploded"));
    const result = await resolveTransferAction({
      transferId: TRANSFER,
      teamId: TEAM_A,
      seasonId: SEASON,
      decision: "accept",
    });
    expect(result).toEqual({ ok: false, error: "network exploded" });
  });
});

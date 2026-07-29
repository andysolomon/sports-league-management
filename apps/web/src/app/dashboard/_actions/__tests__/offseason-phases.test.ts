import { describe, it, expect, beforeEach, vi } from "vitest";

const {
  mockAuth,
  mockResolveOrgContext,
  mockResolveOrgRole,
  mockGetLeagueOrgId,
  mockGetDraft,
  mockBeginOffseason,
  mockAdvanceOffseasonPhase,
  mockApplyTrainingAllocations,
  mockRevalidatePath,
} = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockResolveOrgContext: vi.fn(),
  mockResolveOrgRole: vi.fn(),
  mockGetLeagueOrgId: vi.fn(),
  mockGetDraft: vi.fn(),
  mockBeginOffseason: vi.fn(),
  mockAdvanceOffseasonPhase: vi.fn(),
  mockApplyTrainingAllocations: vi.fn(),
  mockRevalidatePath: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: mockAuth }));
vi.mock("@/lib/org-context", () => ({
  resolveOrgContext: mockResolveOrgContext,
  resolveOrgRole: mockResolveOrgRole,
}));
vi.mock("@/lib/data-api", () => ({
  getLeagueOrgId: mockGetLeagueOrgId,
  getDraft: mockGetDraft,
  beginOffseason: mockBeginOffseason,
  advanceOffseasonPhase: mockAdvanceOffseasonPhase,
  applyTrainingAllocations: mockApplyTrainingAllocations,
}));
vi.mock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));

import { advanceOffseasonPhaseAction } from "../offseason-phases";

const LEAGUE = "league_1";
const SEASON = "season_1";
const USER = "user_admin";

function offseason(phase: string) {
  return {
    id: "off_1",
    leagueId: LEAGUE,
    seasonId: SEASON,
    phase,
    completedPhases: ["rollover"],
    scoutingPointsTotal: 100,
    scoutingPointsSpent: 0,
    trainingPointsTotal: 100,
    trainingPointsSpent: 0,
    createdAt: "2028-01-01T00:00:00.000Z",
    updatedAt: "2028-01-01T00:00:00.000Z",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ userId: USER });
  mockGetLeagueOrgId.mockResolvedValue("org_1");
  mockResolveOrgRole.mockResolvedValue("admin");
  mockResolveOrgContext.mockResolvedValue({ visibleLeagueIds: [LEAGUE] });
  mockGetDraft.mockResolvedValue(null);
  mockBeginOffseason.mockResolvedValue(offseason("recruiting"));
  mockAdvanceOffseasonPhase.mockResolvedValue({
    changed: true,
    offseason: offseason("transfers"),
  });
  mockApplyTrainingAllocations.mockResolvedValue({
    applied: 2,
    playersTrained: 1,
    pointsPlaced: 6,
  });
});

describe("advanceOffseasonPhaseAction", () => {
  it("claims the lease as the ADMIN, not as the individual transition", async () => {
    /*
     * The regression B6's e2e caught. `ownerId` used to be
     * `${userId}:${from}:${to}`, so every move claimed the lease under a new
     * name — and the admin's own 30-second lease from the previous phase then
     * read as a foreign one, refusing the next Advance as `phase_busy`. An
     * admin walking their own offseason could not get past the second step.
     */
    await advanceOffseasonPhaseAction({
      leagueId: LEAGUE,
      seasonId: SEASON,
      expectedPhase: "recruiting",
      to: "transfers",
    });
    await advanceOffseasonPhaseAction({
      leagueId: LEAGUE,
      seasonId: SEASON,
      expectedPhase: "transfers",
      to: "draft",
    });

    const owners = mockAdvanceOffseasonPhase.mock.calls.map(
      ([args]) => args.ownerId,
    );
    expect(owners).toEqual([USER, USER]);
  });

  it("applies training before it leaves the training phase", async () => {
    /*
     * Order matters. Applying AFTER the advance would leave a failure with the
     * offseason already past `training` and every allocation stranded —
     * unapplied, unspendable, and with no phase left to retry from.
     */
    const order: string[] = [];
    mockApplyTrainingAllocations.mockImplementation(async () => {
      order.push("apply");
      return { applied: 1, playersTrained: 1, pointsPlaced: 6 };
    });
    mockAdvanceOffseasonPhase.mockImplementation(async () => {
      order.push("advance");
      return { changed: true, offseason: offseason("activate") };
    });

    await advanceOffseasonPhaseAction({
      leagueId: LEAGUE,
      seasonId: SEASON,
      expectedPhase: "training",
      to: "activate",
    });

    expect(order).toEqual(["apply", "advance"]);
  });

  it("leaves the offseason in training when applying fails", async () => {
    mockApplyTrainingAllocations.mockRejectedValue(new Error("boom"));
    const result = await advanceOffseasonPhaseAction({
      leagueId: LEAGUE,
      seasonId: SEASON,
      expectedPhase: "training",
      to: "activate",
    });
    expect(result.ok).toBe(false);
    expect(mockAdvanceOffseasonPhase).not.toHaveBeenCalled();
  });

  it("does not apply training on any other transition", async () => {
    await advanceOffseasonPhaseAction({
      leagueId: LEAGUE,
      seasonId: SEASON,
      expectedPhase: "free_agency",
      to: "training",
    });
    expect(mockApplyTrainingAllocations).not.toHaveBeenCalled();
  });

  it("refuses a caller who cannot manage the league", async () => {
    mockResolveOrgRole.mockResolvedValue("member");
    const result = await advanceOffseasonPhaseAction({
      leagueId: LEAGUE,
      seasonId: SEASON,
      expectedPhase: "recruiting",
      to: "transfers",
    });
    expect(result).toEqual({ ok: false, error: "not_authorized" });
    expect(mockAdvanceOffseasonPhase).not.toHaveBeenCalled();
  });
});

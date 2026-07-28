import { describe, it, expect, beforeEach, vi } from "vitest";

const {
  mockAuth,
  mockResolveOrgRole,
  mockGetLeagueOrgId,
  mockGetTeamLeagueId,
  mockCanManageTeam,
  mockScoutProspect,
  mockSignProspect,
} = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockResolveOrgRole: vi.fn(),
  mockGetLeagueOrgId: vi.fn(),
  mockGetTeamLeagueId: vi.fn(),
  mockCanManageTeam: vi.fn(),
  mockScoutProspect: vi.fn(),
  mockSignProspect: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: mockAuth }));
vi.mock("@/lib/org-context", () => ({ resolveOrgRole: mockResolveOrgRole }));
vi.mock("@/lib/authorization", () => ({ canManageTeam: mockCanManageTeam }));
vi.mock("@/lib/data-api", () => ({
  getLeagueOrgId: mockGetLeagueOrgId,
  getTeamLeagueId: mockGetTeamLeagueId,
  scoutProspect: mockScoutProspect,
  signProspect: mockSignProspect,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import {
  scoutProspectAction,
  signProspectAction,
} from "../recruiting";

const TEAM_A = "team_a";
const TEAM_B = "team_b";
const SEASON = "season_1";
const PROSPECT = "prospect_1";

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ userId: "coach_a" });
  mockGetTeamLeagueId.mockResolvedValue("league_1");
  mockGetLeagueOrgId.mockResolvedValue("org_1");
  // A coach, not an org admin — the case the per-team gate exists for.
  mockResolveOrgRole.mockResolvedValue("member");
  mockCanManageTeam.mockImplementation(async (teamId: string) => teamId === TEAM_A);
  mockScoutProspect.mockResolvedValue({
    prospect: { id: PROSPECT, scoutLevel: 1 },
    scoutingPointsSpent: 5,
    scoutingPointsTotal: 100,
  });
  mockSignProspect.mockResolvedValue({
    prospect: { id: PROSPECT },
    playerId: "player_1",
    alreadySigned: false,
  });
});

/*
 * The roadmap's one non-negotiable multiplayer detail (B3).
 *
 * Both actions take a `teamId` and authorize on it. Getting this wrong is the
 * single thing that would force a rewrite when a second coach joins a league —
 * an action gated only on "is org admin" cannot later be scoped to one team
 * without changing every call site.
 */
describe("recruiting actions authorize per team", () => {
  it("lets a coach act for the team they manage", async () => {
    const scouted = await scoutProspectAction({
      prospectId: PROSPECT,
      teamId: TEAM_A,
      seasonId: SEASON,
    });
    expect(scouted.ok).toBe(true);
    expect(mockScoutProspect).toHaveBeenCalledWith(
      expect.objectContaining({ teamId: TEAM_A, actorUserId: "coach_a" }),
    );
  });

  it("refuses a coach of team A scouting for team B", async () => {
    const result = await scoutProspectAction({
      prospectId: PROSPECT,
      teamId: TEAM_B,
      seasonId: SEASON,
    });
    expect(result).toEqual({ ok: false, error: "not_authorized" });
    // Refused BEFORE the mutation, not by it. A gate that only rejected at the
    // database would have already spent the budget.
    expect(mockScoutProspect).not.toHaveBeenCalled();
  });

  it("refuses a coach of team A signing for team B", async () => {
    const result = await signProspectAction({
      prospectId: PROSPECT,
      teamId: TEAM_B,
      seasonId: SEASON,
    });
    expect(result).toEqual({ ok: false, error: "not_authorized" });
    expect(mockSignProspect).not.toHaveBeenCalled();
  });

  it("lets an org admin act for any team in the league", async () => {
    // Solo/commissioner mode: one admin passes each team's id in turn. The
    // same mutation serves both shapes, which is the point.
    mockResolveOrgRole.mockResolvedValue("admin");
    const result = await signProspectAction({
      prospectId: PROSPECT,
      teamId: TEAM_B,
      seasonId: SEASON,
    });
    expect(result.ok).toBe(true);
  });

  it("refuses an unauthenticated caller before touching anything", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const result = await scoutProspectAction({
      prospectId: PROSPECT,
      teamId: TEAM_A,
      seasonId: SEASON,
    });
    expect(result).toEqual({ ok: false, error: "unauthorized" });
    expect(mockGetTeamLeagueId).not.toHaveBeenCalled();
  });
});

describe("recruiting action failures", () => {
  it("surfaces the bare reason a Convex error wraps", async () => {
    /*
     * Convex wraps a thrown Error in its own message. The UI switches on the
     * bare reason, so an action that passed the wrapper through would show a
     * stack-flavoured string where a sentence belongs.
     */
    mockScoutProspect.mockRejectedValue(
      new Error("[Request ID: abc] Server Error: scouting_budget_exhausted"),
    );
    const result = await scoutProspectAction({
      prospectId: PROSPECT,
      teamId: TEAM_A,
      seasonId: SEASON,
    });
    expect(result).toEqual({ ok: false, error: "scouting_budget_exhausted" });
  });

  it("passes an unrecognised failure through rather than inventing one", async () => {
    mockSignProspect.mockRejectedValue(new Error("network exploded"));
    const result = await signProspectAction({
      prospectId: PROSPECT,
      teamId: TEAM_A,
      seasonId: SEASON,
    });
    expect(result).toEqual({ ok: false, error: "network exploded" });
  });
});

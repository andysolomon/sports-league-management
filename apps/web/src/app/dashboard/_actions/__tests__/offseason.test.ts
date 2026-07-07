import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockAuth,
  mockCanManageTeam,
  mockResolveOrgContext,
  mockResolveOrgRole,
  mockGetLeagueOrgId,
  mockGetPlayer,
  mockGetTeamLeagueId,
  mockRelease,
  mockSign,
} = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockCanManageTeam: vi.fn(),
  mockResolveOrgContext: vi.fn(),
  mockResolveOrgRole: vi.fn(),
  mockGetLeagueOrgId: vi.fn(),
  mockGetPlayer: vi.fn(),
  mockGetTeamLeagueId: vi.fn(),
  mockRelease: vi.fn(),
  mockSign: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: mockAuth }));
vi.mock("@/lib/authorization", () => ({ canManageTeam: mockCanManageTeam }));
vi.mock("@/lib/org-context", () => ({
  resolveOrgContext: mockResolveOrgContext,
  resolveOrgRole: mockResolveOrgRole,
}));
vi.mock("@/lib/data-api", () => ({
  getLeagueOrgId: mockGetLeagueOrgId,
  getPlayer: mockGetPlayer,
  getTeamLeagueId: mockGetTeamLeagueId,
  releasePlayerToFreeAgency: mockRelease,
  signFreeAgent: mockSign,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import {
  releaseToFreeAgencyAction,
  signFreeAgentAction,
} from "../offseason";

const USER = "user_1";
const ORG = "org_1";
const LEAGUE = "league_1";
const TEAM_A = "team_a";
const TEAM_B = "team_b";
const PLAYER = "player_1";
const SEASON = "season_1";

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ userId: USER });
  mockResolveOrgContext.mockResolvedValue({ visibleLeagueIds: [LEAGUE], orgIds: [ORG] });
  mockGetLeagueOrgId.mockResolvedValue(ORG);
  mockGetTeamLeagueId.mockResolvedValue(LEAGUE);
  mockGetPlayer.mockResolvedValue({
    id: PLAYER,
    teamId: TEAM_A,
    status: "active",
    name: "Test",
    position: "WR",
    positionGroup: null,
    jerseyNumber: null,
    dateOfBirth: null,
    headshotUrl: null,
    experienceYears: null,
    grade: null,
    squad: null,
    hometown: null,
  });
  mockRelease.mockResolvedValue({ playerId: PLAYER });
  mockSign.mockResolvedValue({ playerId: PLAYER, teamId: TEAM_B, overCap: false });
});

describe("releaseToFreeAgencyAction", () => {
  it("allows an org admin", async () => {
    mockResolveOrgRole.mockResolvedValue("admin");
    mockCanManageTeam.mockResolvedValue(false);

    const result = await releaseToFreeAgencyAction({ playerId: PLAYER });
    expect(result).toEqual({ ok: true, data: { playerId: PLAYER } });
    expect(mockRelease).toHaveBeenCalledWith({ playerId: PLAYER });
  });

  it("allows the coach of the player's team", async () => {
    mockResolveOrgRole.mockResolvedValue("coach");
    mockCanManageTeam.mockResolvedValue(true);

    const result = await releaseToFreeAgencyAction({ playerId: PLAYER });
    expect(result.ok).toBe(true);
  });

  it("rejects a coach acting on another team's player", async () => {
    mockResolveOrgRole.mockResolvedValue("coach");
    mockCanManageTeam.mockResolvedValue(false);

    const result = await releaseToFreeAgencyAction({ playerId: PLAYER });
    expect(result).toEqual({ ok: false, error: "not_authorized" });
    expect(mockRelease).not.toHaveBeenCalled();
  });
});

describe("signFreeAgentAction", () => {
  it("allows an org admin to sign to any team", async () => {
    mockResolveOrgRole.mockResolvedValue("admin");
    mockCanManageTeam.mockResolvedValue(false);

    const result = await signFreeAgentAction({
      playerId: PLAYER,
      teamId: TEAM_B,
      seasonId: SEASON,
    });
    expect(result).toEqual({
      ok: true,
      data: { playerId: PLAYER, teamId: TEAM_B, overCap: false },
    });
    expect(mockSign).toHaveBeenCalledWith({
      playerId: PLAYER,
      teamId: TEAM_B,
      seasonId: SEASON,
      actorUserId: USER,
    });
  });

  it("allows the coach of the target team", async () => {
    mockResolveOrgRole.mockResolvedValue("coach");
    mockCanManageTeam.mockResolvedValue(true);

    const result = await signFreeAgentAction({
      playerId: PLAYER,
      teamId: TEAM_B,
      seasonId: SEASON,
    });
    expect(result.ok).toBe(true);
  });

  it("rejects a coach signing to another team", async () => {
    mockResolveOrgRole.mockResolvedValue("coach");
    mockCanManageTeam.mockResolvedValue(false);

    const result = await signFreeAgentAction({
      playerId: PLAYER,
      teamId: TEAM_B,
      seasonId: SEASON,
    });
    expect(result).toEqual({ ok: false, error: "not_authorized" });
    expect(mockSign).not.toHaveBeenCalled();
  });
});

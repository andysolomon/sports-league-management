import { describe, it, expect, beforeEach, vi } from "vitest";

const { mockAuth, mockAuthorizeTeamMutation, mockSetTeamProgram, mockRevalidatePath } =
  vi.hoisted(() => ({
    mockAuth: vi.fn(),
    mockAuthorizeTeamMutation: vi.fn(),
    mockSetTeamProgram: vi.fn(),
    mockRevalidatePath: vi.fn(),
  }));

vi.mock("@clerk/nextjs/server", () => ({ auth: mockAuth }));
vi.mock("@/lib/authorization", () => ({
  authorizeTeamMutation: mockAuthorizeTeamMutation,
}));
vi.mock("@/lib/data-api", () => ({
  setTeamProgram: mockSetTeamProgram,
}));
vi.mock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));

import { saveTeamProgramAction } from "../team-program";

const TEAM_A = "team_a";
const TEAM_B = "team_b";
const SEASON = "season_1";

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ userId: "coach_a" });
  mockAuthorizeTeamMutation.mockImplementation(async (teamId: string) => ({
    userId: "coach_a",
    role: "coach",
    isAuthorized: teamId === TEAM_A,
  }));
  mockSetTeamProgram.mockResolvedValue({
    id: "prog_1",
    leagueId: "league_1",
    seasonId: SEASON,
    teamId: TEAM_A,
    offenseScheme: "flexbone",
    defenseScheme: null,
    tempo: null,
    blitzRate: null,
    aggression: null,
    prestige: null,
    facilitiesTier: null,
    seasonGoalsJson: null,
    jobSecurity: null,
    boosterConfidence: null,
    updatedAt: "2028-01-01T00:00:00.000Z",
  });
});

describe("saveTeamProgramAction", () => {
  it("rejects a coach saving another team's scheme", async () => {
    const result = await saveTeamProgramAction({
      seasonId: SEASON,
      teamId: TEAM_B,
      offenseScheme: "air_raid",
    });
    expect(result).toEqual({ ok: false, error: "not_authorized" });
    expect(mockSetTeamProgram).not.toHaveBeenCalled();
  });

  it("allows saving for the caller's team", async () => {
    const result = await saveTeamProgramAction({
      seasonId: SEASON,
      teamId: TEAM_A,
      offenseScheme: "flexbone",
    });
    expect(result.ok).toBe(true);
    expect(mockSetTeamProgram).toHaveBeenCalled();
  });
});

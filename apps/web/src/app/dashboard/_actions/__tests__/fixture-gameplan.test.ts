import { describe, it, expect, beforeEach, vi } from "vitest";

const {
  mockAuth,
  mockAuthorizeTeamMutation,
  mockSetFixtureGameplan,
  mockRevalidatePath,
} = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockAuthorizeTeamMutation: vi.fn(),
  mockSetFixtureGameplan: vi.fn(),
  mockRevalidatePath: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: mockAuth }));
vi.mock("@/lib/authorization", () => ({
  authorizeTeamMutation: mockAuthorizeTeamMutation,
}));
vi.mock("@/lib/data-api", () => ({
  setFixtureGameplan: mockSetFixtureGameplan,
}));
vi.mock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));

import { saveFixtureGameplanAction } from "../fixture-gameplan";

const TEAM_A = "team_a";
const TEAM_B = "team_b";

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ userId: "coach_a" });
  mockAuthorizeTeamMutation.mockImplementation(async (teamId: string) => ({
    userId: "coach_a",
    role: "coach",
    isAuthorized: teamId === TEAM_A,
  }));
  mockSetFixtureGameplan.mockResolvedValue({
    id: "gp_1",
    leagueId: "league_1",
    seasonId: "season_1",
    fixtureId: "fx_1",
    teamId: TEAM_A,
    focus: "establish_run",
    updatedAt: "2028-01-01T00:00:00.000Z",
  });
});

describe("saveFixtureGameplanAction", () => {
  it("rejects setting a gameplan for another team", async () => {
    const result = await saveFixtureGameplanAction({
      fixtureId: "fx_1",
      seasonId: "season_1",
      teamId: TEAM_B,
      focus: "attack_pass",
    });
    expect(result).toEqual({ ok: false, error: "not_authorized" });
    expect(mockSetFixtureGameplan).not.toHaveBeenCalled();
  });
});

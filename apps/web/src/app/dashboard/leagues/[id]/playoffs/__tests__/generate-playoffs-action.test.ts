import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockPlayoffsV1,
  mockAuth,
  mockGetLeague,
  mockGetLeagueOrgId,
  mockResolveOrgContext,
  mockResolveOrgRole,
  mockCanManageRoster,
  mockGeneratePlayoffBracket,
} = vi.hoisted(() => ({
  mockPlayoffsV1: vi.fn(),
  mockAuth: vi.fn(),
  mockGetLeague: vi.fn(),
  mockGetLeagueOrgId: vi.fn(),
  mockResolveOrgContext: vi.fn(),
  mockResolveOrgRole: vi.fn(),
  mockCanManageRoster: vi.fn(),
  mockGeneratePlayoffBracket: vi.fn(),
}));

vi.mock("@/lib/flags", () => ({ playoffsV1: mockPlayoffsV1 }));
vi.mock("@clerk/nextjs/server", () => ({ auth: mockAuth }));
vi.mock("@/lib/data-api", () => ({
  generatePlayoffBracket: mockGeneratePlayoffBracket,
  getLeague: mockGetLeague,
  getLeagueOrgId: mockGetLeagueOrgId,
}));
vi.mock("@/lib/org-context", () => ({
  resolveOrgContext: mockResolveOrgContext,
  resolveOrgRole: mockResolveOrgRole,
}));
vi.mock("@/lib/permissions", () => ({ canManageRoster: mockCanManageRoster }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { generatePlayoffsAction } from "../actions";

const LEAGUE = "league_1";
const SEASON = "season_1";

function authorize() {
  mockPlayoffsV1.mockResolvedValue(true);
  mockAuth.mockResolvedValue({ userId: "user_1" });
  mockResolveOrgContext.mockResolvedValue({ visibleLeagueIds: [LEAGUE] });
  mockGetLeague.mockResolvedValue({ id: LEAGUE, name: "League" });
  mockGetLeagueOrgId.mockResolvedValue("org_1");
  mockResolveOrgRole.mockResolvedValue("org:admin");
  mockCanManageRoster.mockReturnValue(true);
}

describe("generatePlayoffsAction (WSM-000164)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("generates a bracket for an authorized manager", async () => {
    authorize();
    mockGeneratePlayoffBracket.mockResolvedValue({
      bracketId: "b1",
      size: 8,
      rounds: 3,
      matchups: 7,
    });

    const res = await generatePlayoffsAction({
      leagueId: LEAGUE,
      seasonId: SEASON,
      size: 8,
    });

    expect(res).toEqual({
      ok: true,
      bracketId: "b1",
      size: 8,
      rounds: 3,
      matchups: 7,
    });
    expect(mockGeneratePlayoffBracket).toHaveBeenCalledWith({
      seasonId: SEASON,
      size: 8,
      actorUserId: "user_1",
      confirm: undefined,
    });
  });

  it("returns needsConfirm when the bracket already has a played game", async () => {
    authorize();
    mockGeneratePlayoffBracket.mockRejectedValue(
      new Error("Uncaught Error: bracket_has_results"),
    );
    const res = await generatePlayoffsAction({
      leagueId: LEAGUE,
      seasonId: SEASON,
      size: 4,
    });
    expect(res).toEqual({ ok: false, needsConfirm: true });
  });

  it("passes confirm through", async () => {
    authorize();
    mockGeneratePlayoffBracket.mockResolvedValue({
      bracketId: "b1",
      size: 4,
      rounds: 2,
      matchups: 3,
    });
    await generatePlayoffsAction({
      leagueId: LEAGUE,
      seasonId: SEASON,
      size: 4,
      confirm: true,
    });
    expect(mockGeneratePlayoffBracket).toHaveBeenCalledWith(
      expect.objectContaining({ confirm: true }),
    );
  });

  it("maps not_enough_teams to a friendly error", async () => {
    authorize();
    mockGeneratePlayoffBracket.mockRejectedValue(
      new Error("Uncaught Error: not_enough_teams"),
    );
    const res = await generatePlayoffsAction({
      leagueId: LEAGUE,
      seasonId: SEASON,
      size: 16,
    });
    expect(res).toMatchObject({ ok: false });
    expect("error" in res && res.error).toMatch(/Not enough teams/);
  });

  it("rejects a non-manager", async () => {
    authorize();
    mockCanManageRoster.mockReturnValue(false);
    const res = await generatePlayoffsAction({
      leagueId: LEAGUE,
      seasonId: SEASON,
      size: 4,
    });
    expect(res).toEqual({ ok: false, error: "not_authorized" });
    expect(mockGeneratePlayoffBracket).not.toHaveBeenCalled();
  });

  it("rejects when the flag is off", async () => {
    authorize();
    mockPlayoffsV1.mockResolvedValue(false);
    const res = await generatePlayoffsAction({
      leagueId: LEAGUE,
      seasonId: SEASON,
      size: 4,
    });
    expect(res).toEqual({ ok: false, error: "flag_disabled" });
  });
});

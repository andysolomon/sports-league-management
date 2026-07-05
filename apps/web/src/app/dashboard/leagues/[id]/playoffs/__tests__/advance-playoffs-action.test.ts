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
  mockGetSeasons,
  mockGetPlayoffBracket,
  mockListFixturesBySeason,
} = vi.hoisted(() => ({
  mockPlayoffsV1: vi.fn(),
  mockAuth: vi.fn(),
  mockGetLeague: vi.fn(),
  mockGetLeagueOrgId: vi.fn(),
  mockResolveOrgContext: vi.fn(),
  mockResolveOrgRole: vi.fn(),
  mockCanManageRoster: vi.fn(),
  mockGeneratePlayoffBracket: vi.fn(),
  mockGetSeasons: vi.fn(),
  mockGetPlayoffBracket: vi.fn(),
  mockListFixturesBySeason: vi.fn(),
}));

vi.mock("@/lib/flags", () => ({ playoffsV1: mockPlayoffsV1 }));
vi.mock("@clerk/nextjs/server", () => ({ auth: mockAuth }));
vi.mock("@/lib/data-api", () => ({
  generatePlayoffBracket: mockGeneratePlayoffBracket,
  getLeague: mockGetLeague,
  getLeagueOrgId: mockGetLeagueOrgId,
  getSeasons: mockGetSeasons,
  getPlayoffBracket: mockGetPlayoffBracket,
  listFixturesBySeason: mockListFixturesBySeason,
}));
vi.mock("@/lib/org-context", () => ({
  resolveOrgContext: mockResolveOrgContext,
  resolveOrgRole: mockResolveOrgRole,
}));
vi.mock("@/lib/permissions", () => ({ canManageRoster: mockCanManageRoster }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { advanceToPlayoffsAction } from "../actions";

const LEAGUE = "league_1";
const SEASON = "season_1";

const ACTIVE_SEASON = {
  id: SEASON,
  name: "2026",
  leagueId: LEAGUE,
  status: "active",
  playoffTeams: 8,
  playoffFormat: "single",
  divisionWinnersQualify: false,
};

function authorize() {
  mockPlayoffsV1.mockResolvedValue(true);
  mockAuth.mockResolvedValue({ userId: "user_1" });
  mockResolveOrgContext.mockResolvedValue({ visibleLeagueIds: [LEAGUE] });
  mockGetLeague.mockResolvedValue({ id: LEAGUE, name: "League" });
  mockGetLeagueOrgId.mockResolvedValue("org_1");
  mockResolveOrgRole.mockResolvedValue("org:admin");
  mockCanManageRoster.mockReturnValue(true);
  mockGetSeasons.mockResolvedValue([ACTIVE_SEASON]);
  mockGetPlayoffBracket.mockResolvedValue(null);
}

describe("advanceToPlayoffsAction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects when the regular season is incomplete", async () => {
    authorize();
    mockListFixturesBySeason.mockResolvedValue([
      { stage: "regular", status: "final" },
      { stage: "regular", status: "scheduled" },
    ]);

    const res = await advanceToPlayoffsAction({ leagueId: LEAGUE });

    expect(res).toEqual({ ok: false, error: "regular_season_incomplete" });
    expect(mockGeneratePlayoffBracket).not.toHaveBeenCalled();
  });

  it("rejects double-advance when a bracket already exists", async () => {
    authorize();
    mockListFixturesBySeason.mockResolvedValue([
      { stage: "regular", status: "final" },
    ]);
    mockGetPlayoffBracket.mockResolvedValue({
      bracketId: "b1",
      size: 8,
      rounds: 3,
      format: "single",
      matchups: [],
      champion: null,
    });

    const res = await advanceToPlayoffsAction({ leagueId: LEAGUE });

    expect(res).toEqual({ ok: false, error: "already_advanced" });
    expect(mockGeneratePlayoffBracket).not.toHaveBeenCalled();
  });

  it("rejects when no season exists", async () => {
    authorize();
    mockGetSeasons.mockResolvedValue([]);

    const res = await advanceToPlayoffsAction({ leagueId: LEAGUE });

    expect(res).toEqual({ ok: false, error: "no_season" });
    expect(mockGeneratePlayoffBracket).not.toHaveBeenCalled();
  });

  it("generates a bracket when preconditions pass", async () => {
    authorize();
    mockListFixturesBySeason.mockResolvedValue([
      { stage: "regular", status: "final" },
      { stage: "regular", status: "final" },
      { stage: "playoff", status: "scheduled" },
    ]);
    mockGeneratePlayoffBracket.mockResolvedValue({
      bracketId: "b1",
      size: 8,
      rounds: 3,
      matchups: 7,
    });

    const res = await advanceToPlayoffsAction({ leagueId: LEAGUE });

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
      divisionWinnersQualify: false,
      format: "single",
    });
  });
});

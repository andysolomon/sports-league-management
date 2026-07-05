import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockSchedulesStandingsV1,
  mockAuth,
  mockGetLeague,
  mockGetLeagueOrgId,
  mockResolveOrgContext,
  mockResolveOrgRole,
  mockCanManageRoster,
  mockGetFixture,
  mockRecordGameResult,
  mockUpsertGamePlayLog,
  mockSimulateAndPersistFixture,
  mockListFixturesBySeason,
  mockGetPlayoffBracket,
} = vi.hoisted(() => ({
  mockSchedulesStandingsV1: vi.fn(),
  mockAuth: vi.fn(),
  mockGetLeague: vi.fn(),
  mockGetLeagueOrgId: vi.fn(),
  mockResolveOrgContext: vi.fn(),
  mockResolveOrgRole: vi.fn(),
  mockCanManageRoster: vi.fn(),
  mockGetFixture: vi.fn(),
  mockRecordGameResult: vi.fn(),
  mockUpsertGamePlayLog: vi.fn(),
  mockSimulateAndPersistFixture: vi.fn(),
  mockListFixturesBySeason: vi.fn(),
  mockGetPlayoffBracket: vi.fn(),
}));

vi.mock("@/lib/flags", () => ({
  schedulesStandingsV1: mockSchedulesStandingsV1,
}));
vi.mock("@clerk/nextjs/server", () => ({ auth: mockAuth }));
vi.mock("@/lib/data-api", () => ({
  getFixture: mockGetFixture,
  recordGameResult: mockRecordGameResult,
  upsertGamePlayLog: mockUpsertGamePlayLog,
  getLeague: mockGetLeague,
  getLeagueOrgId: mockGetLeagueOrgId,
  listFixturesBySeason: mockListFixturesBySeason,
  getSeason: vi.fn(),
  generatePlayoffBracket: vi.fn(),
  getPlayoffBracket: mockGetPlayoffBracket,
  createFixture: vi.fn(),
  deleteFixture: vi.fn(),
  generateSeasonSchedule: vi.fn(),
}));
vi.mock("@/lib/org-context", () => ({
  resolveOrgContext: mockResolveOrgContext,
  resolveOrgRole: mockResolveOrgRole,
}));
vi.mock("@/lib/permissions", () => ({
  canManageRoster: mockCanManageRoster,
}));
vi.mock("@/lib/analytics", () => ({
  trackFixtureCreated: vi.fn(),
  trackResultRecorded: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/simulate-fixture", () => ({
  simulateAndPersistFixture: mockSimulateAndPersistFixture,
}));

import {
  recordGameResultAction,
  simulateGameAction,
  simulatePlayoffsAction,
  simulateRegularSeasonAction,
  simulateWeekAction,
} from "../actions";

const LEAGUE = "league_1";
const SEASON = "season_1";
const FIX = "fixture_abc";
const USER = "user_1";

function fixture(
  overrides: Partial<{
    id: string;
    week: number | null;
    stage: "regular" | "playoff";
    status: "scheduled" | "final";
  }> = {},
) {
  return {
    id: overrides.id ?? FIX,
    seasonId: SEASON,
    homeTeamId: "team_home",
    awayTeamId: "team_away",
    homeTeamName: "Home",
    awayTeamName: "Away",
    scheduledAt: null,
    week: overrides.week ?? 1,
    venue: null,
    status: overrides.status ?? ("scheduled" as const),
    stage: overrides.stage ?? ("regular" as const),
    createdAt: "2026-01-01T00:00:00.000Z",
    createdBy: USER,
  };
}

function authorize() {
  mockSchedulesStandingsV1.mockResolvedValue(true);
  mockAuth.mockResolvedValue({ userId: USER });
  mockResolveOrgContext.mockResolvedValue({ visibleLeagueIds: [LEAGUE] });
  mockGetLeague.mockResolvedValue({ id: LEAGUE, name: "League" });
  mockGetLeagueOrgId.mockResolvedValue("org_1");
  mockResolveOrgRole.mockResolvedValue("org:admin");
  mockCanManageRoster.mockReturnValue(true);
  mockGetFixture.mockResolvedValue(fixture());
  mockSimulateAndPersistFixture.mockResolvedValue({
    homeScore: 21,
    awayScore: 14,
    usedScoreFallback: false,
  });
}

describe("simulateGameAction (PBP Slice B)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authorize();
  });

  it("delegates to simulateAndPersistFixture and returns the score", async () => {
    mockSimulateAndPersistFixture.mockResolvedValue({
      homeScore: 28,
      awayScore: 21,
      usedScoreFallback: false,
    });

    const res = await simulateGameAction({ leagueId: LEAGUE, fixtureId: FIX });

    expect(res).toEqual({ ok: true, homeScore: 28, awayScore: 21 });
    expect(mockSimulateAndPersistFixture).toHaveBeenCalledWith({
      fixture: fixture(),
      orgContext: { visibleLeagueIds: [LEAGUE] },
      actorUserId: USER,
      decisive: false,
      profileCache: expect.any(Map),
    });
  });
});

describe("simulateWeekAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authorize();
  });

  it("sims only unplayed fixtures in the requested week", async () => {
    const week1A = fixture({ id: "w1a", week: 1 });
    const week1B = fixture({ id: "w1b", week: 1 });
    const week2 = fixture({ id: "w2", week: 2 });
    const week1Final = fixture({ id: "w1f", week: 1, status: "final" });
    mockListFixturesBySeason.mockResolvedValue([
      week1A,
      week1B,
      week2,
      week1Final,
    ]);

    const res = await simulateWeekAction({
      leagueId: LEAGUE,
      seasonId: SEASON,
      week: 1,
    });

    expect(res).toEqual({ ok: true, simulated: 2 });
    expect(mockSimulateAndPersistFixture).toHaveBeenCalledTimes(2);
    const calledIds = mockSimulateAndPersistFixture.mock.calls.map(
      ([arg]) => arg.fixture.id,
    );
    expect(calledIds).toEqual(["w1a", "w1b"]);
    expect(mockSimulateAndPersistFixture.mock.calls[0][0]).toMatchObject({
      bulkStats: true,
      profileCache: expect.any(Map),
    });
  });
});

describe("simulateRegularSeasonAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authorize();
  });

  it("skips playoff fixtures", async () => {
    const regular = fixture({ id: "reg", stage: "regular" });
    const playoff = fixture({ id: "po", stage: "playoff", week: null });
    mockListFixturesBySeason.mockResolvedValue([regular, playoff]);

    const res = await simulateRegularSeasonAction({
      leagueId: LEAGUE,
      seasonId: SEASON,
    });

    expect(res).toEqual({ ok: true, simulated: 1 });
    expect(mockSimulateAndPersistFixture).toHaveBeenCalledTimes(1);
    expect(mockSimulateAndPersistFixture.mock.calls[0][0].fixture.id).toBe(
      "reg",
    );
  });
});

describe("simulatePlayoffsAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authorize();
  });

  it("returns no_playoffs when the bracket is missing", async () => {
    mockGetPlayoffBracket.mockResolvedValue(null);

    const res = await simulatePlayoffsAction({
      leagueId: LEAGUE,
      seasonId: SEASON,
    });

    expect(res).toEqual({ ok: false, error: "no_playoffs" });
    expect(mockSimulateAndPersistFixture).not.toHaveBeenCalled();
  });

  it("sims playoff fixtures decisively when a bracket exists", async () => {
    const playoff = fixture({ id: "po1", stage: "playoff", week: null });
    mockGetPlayoffBracket
      .mockResolvedValueOnce({
        seasonId: SEASON,
        matchups: [{ round: 1, homeTeamId: "team_home" }],
      })
      .mockResolvedValueOnce({
        seasonId: SEASON,
        matchups: [
          {
            round: 2,
            homeTeamId: "team_home",
            homeTeamName: "Home",
            awayTeamName: "Away",
            winnerTeamId: "team_home",
          },
        ],
      });
    mockListFixturesBySeason
      .mockResolvedValueOnce([playoff])
      .mockResolvedValueOnce([]);

    const res = await simulatePlayoffsAction({
      leagueId: LEAGUE,
      seasonId: SEASON,
    });

    expect(res).toEqual({
      ok: true,
      playoffGames: 1,
      champion: "Home",
    });
    expect(mockSimulateAndPersistFixture).toHaveBeenCalledWith({
      fixture: playoff,
      orgContext: { visibleLeagueIds: [LEAGUE] },
      actorUserId: USER,
      decisive: true,
      profileCache: expect.any(Map),
      bulkStats: true,
    });
  });
});

describe("recordGameResultAction (manual path)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authorize();
  });

  it("does not write a play log", async () => {
    mockRecordGameResult.mockResolvedValue({ id: "gr_1" });

    const res = await recordGameResultAction({
      leagueId: LEAGUE,
      fixtureId: FIX,
      homeScore: 14,
      awayScore: 10,
    });

    expect(res).toEqual({ ok: true });
    expect(mockRecordGameResult).toHaveBeenCalledWith({
      fixtureId: FIX,
      homeScore: 14,
      awayScore: 10,
      actorUserId: USER,
    });
    expect(mockUpsertGamePlayLog).not.toHaveBeenCalled();
    expect(mockSimulateAndPersistFixture).not.toHaveBeenCalled();
  });
});

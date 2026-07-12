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
  mockGetSeason,
  mockGeneratePlayoffBracket,
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
  mockGetSeason: vi.fn(),
  mockGeneratePlayoffBracket: vi.fn(),
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
  getSeason: mockGetSeason,
  generatePlayoffBracket: mockGeneratePlayoffBracket,
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
  advancePlayoffRoundAction,
  simulateChampionshipAction,
  simulateSeasonThroughChampionAction,
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
  mockGetSeason.mockResolvedValue({
    id: SEASON,
    leagueId: LEAGUE,
    playoffTeams: 4,
    playoffFormat: "single",
    divisionWinnersQualify: false,
  });
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

  it("rejects double-elimination brackets", async () => {
    mockGetPlayoffBracket.mockResolvedValue({
      seasonId: SEASON,
      format: "double",
      rounds: 2,
      matchups: [{ round: 1, bracketType: "winners" }],
    });

    const res = await simulatePlayoffsAction({
      leagueId: LEAGUE,
      seasonId: SEASON,
    });

    expect(res).toEqual({ ok: false, error: "unsupported_format" });
    expect(mockSimulateAndPersistFixture).not.toHaveBeenCalled();
  });

  it("sims playoff fixtures through semifinal only (champion null)", async () => {
    const semi = fixture({ id: "semi", stage: "playoff", week: null });
    mockGetPlayoffBracket
      .mockResolvedValueOnce({
        seasonId: SEASON,
        format: "single",
        rounds: 2,
        matchups: [
          {
            round: 1,
            fixtureId: "semi",
            bracketType: "winners",
            isBye: false,
            winnerTeamId: null,
          },
          {
            round: 2,
            fixtureId: "final",
            bracketType: "winners",
            isBye: false,
            winnerTeamId: null,
          },
        ],
      })
      .mockResolvedValueOnce({
        seasonId: SEASON,
        format: "single",
        rounds: 2,
        matchups: [
          {
            round: 1,
            fixtureId: "semi",
            bracketType: "winners",
            isBye: false,
            winnerTeamId: null,
          },
          {
            round: 2,
            fixtureId: "final",
            bracketType: "winners",
            isBye: false,
            winnerTeamId: null,
          },
        ],
      })
      .mockResolvedValueOnce({
        seasonId: SEASON,
        format: "single",
        rounds: 2,
        matchups: [
          {
            round: 1,
            fixtureId: "semi",
            bracketType: "winners",
            winnerTeamId: "team_home",
          },
          {
            round: 2,
            fixtureId: "final",
            bracketType: "winners",
            winnerTeamId: null,
          },
        ],
      })
      .mockResolvedValueOnce({
        seasonId: SEASON,
        format: "single",
        rounds: 2,
        matchups: [
          {
            round: 1,
            fixtureId: "semi",
            bracketType: "winners",
            winnerTeamId: "team_home",
            homeTeamName: "Home",
          },
          {
            round: 2,
            fixtureId: "final",
            bracketType: "winners",
            winnerTeamId: null,
          },
        ],
      });
    mockListFixturesBySeason.mockResolvedValue([semi]);

    const res = await simulatePlayoffsAction({
      leagueId: LEAGUE,
      seasonId: SEASON,
    });

    expect(res).toEqual({
      ok: true,
      playoffGames: 1,
      champion: null,
    });
    expect(mockSimulateAndPersistFixture).toHaveBeenCalledTimes(1);
    expect(mockSimulateAndPersistFixture).toHaveBeenCalledWith({
      fixture: semi,
      orgContext: { visibleLeagueIds: [LEAGUE] },
      actorUserId: USER,
      decisive: true,
      profileCache: expect.any(Map),
      bulkStats: true,
    });
  });

  it("rejects viewers (not_authorized)", async () => {
    authorize();
    mockCanManageRoster.mockReturnValue(false);

    const res = await simulatePlayoffsAction({
      leagueId: LEAGUE,
      seasonId: SEASON,
    });

    expect(res).toEqual({ ok: false, error: "not_authorized" });
  });
});

describe("advancePlayoffRoundAction (WSM-000241)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authorize();
  });

  it("simulates only the minimum unresolved round", async () => {
    const semi = fixture({ id: "semi", stage: "playoff", week: null });
    mockGetPlayoffBracket.mockResolvedValue({
      seasonId: SEASON,
      format: "single",
      rounds: 2,
      matchups: [
        {
          round: 1,
          fixtureId: "semi",
          bracketType: "winners",
          isBye: false,
          winnerTeamId: null,
        },
        {
          round: 2,
          fixtureId: "final",
          bracketType: "winners",
          isBye: false,
          winnerTeamId: null,
        },
      ],
    });
    mockListFixturesBySeason.mockResolvedValue([semi]);

    const res = await advancePlayoffRoundAction({
      leagueId: LEAGUE,
      seasonId: SEASON,
    });

    expect(res).toEqual({ ok: true, simulated: 1, round: 1 });
    expect(mockSimulateAndPersistFixture).toHaveBeenCalledTimes(1);
  });

  it("rejects advancing the championship round explicitly", async () => {
    mockGetPlayoffBracket.mockResolvedValue({
      seasonId: SEASON,
      format: "single",
      rounds: 2,
      matchups: [
        {
          round: 1,
          bracketType: "winners",
          isBye: false,
          winnerTeamId: "team_home",
        },
        {
          round: 2,
          fixtureId: "final",
          bracketType: "winners",
          isBye: false,
          winnerTeamId: null,
        },
      ],
    });

    const res = await advancePlayoffRoundAction({
      leagueId: LEAGUE,
      seasonId: SEASON,
    });

    expect(res).toEqual({
      ok: false,
      error: "championship_requires_explicit_sim",
    });
  });
});

describe("simulateChampionshipAction (WSM-000241)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authorize();
  });

  it("simulates only the final and returns the champion name", async () => {
    const finalGame = fixture({ id: "final", stage: "playoff", week: null });
    mockGetPlayoffBracket
      .mockResolvedValueOnce({
        seasonId: SEASON,
        format: "single",
        rounds: 2,
        matchups: [
          {
            round: 2,
            fixtureId: "final",
            bracketType: "winners",
            isBye: false,
            winnerTeamId: null,
            homeTeamId: "team_home",
            homeTeamName: "Home",
            awayTeamName: "Away",
          },
        ],
      })
      .mockResolvedValueOnce({
        seasonId: SEASON,
        format: "single",
        rounds: 2,
        matchups: [
          {
            round: 2,
            fixtureId: "final",
            bracketType: "winners",
            winnerTeamId: "team_home",
            homeTeamId: "team_home",
            homeTeamName: "Home",
            awayTeamName: "Away",
          },
        ],
      });
    mockListFixturesBySeason.mockResolvedValue([finalGame]);

    const res = await simulateChampionshipAction({
      leagueId: LEAGUE,
      seasonId: SEASON,
    });

    expect(res).toEqual({ ok: true, simulated: 1, champion: "Home" });
    expect(mockSimulateAndPersistFixture).toHaveBeenCalledTimes(1);
  });

  it("rejects season/league mismatch", async () => {
    mockGetSeason.mockResolvedValue({
      id: SEASON,
      leagueId: "other_league",
      playoffTeams: 4,
      playoffFormat: "single",
    });

    const res = await simulateChampionshipAction({
      leagueId: LEAGUE,
      seasonId: SEASON,
    });

    expect(res).toEqual({ ok: false, error: "season_league_mismatch" });
    expect(mockSimulateAndPersistFixture).not.toHaveBeenCalled();
  });
});

describe("simulateSeasonThroughChampionAction (WSM-000241)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authorize();
    mockListFixturesBySeason.mockResolvedValue([]);
    mockGeneratePlayoffBracket.mockResolvedValue({ ok: true });
  });

  it("rejects legacy playoff sizes", async () => {
    mockGetSeason.mockResolvedValue({
      id: SEASON,
      leagueId: LEAGUE,
      playoffTeams: 6,
      playoffFormat: "single",
      divisionWinnersQualify: false,
    });

    const res = await simulateSeasonThroughChampionAction({
      leagueId: LEAGUE,
      seasonId: SEASON,
    });

    expect(res).toEqual({ ok: false, error: "invalid_playoff_size" });
    expect(mockGeneratePlayoffBracket).not.toHaveBeenCalled();
  });

  it("rejects double-elimination seasons", async () => {
    mockGetSeason.mockResolvedValue({
      id: SEASON,
      leagueId: LEAGUE,
      playoffTeams: 4,
      playoffFormat: "double",
      divisionWinnersQualify: false,
    });

    const res = await simulateSeasonThroughChampionAction({
      leagueId: LEAGUE,
      seasonId: SEASON,
    });

    expect(res).toEqual({ ok: false, error: "unsupported_format" });
    expect(mockGeneratePlayoffBracket).not.toHaveBeenCalled();
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

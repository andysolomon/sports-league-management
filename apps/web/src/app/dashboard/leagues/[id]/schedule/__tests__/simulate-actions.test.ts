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
  listFixturesBySeason: vi.fn(),
  getSeason: vi.fn(),
  generatePlayoffBracket: vi.fn(),
  getPlayoffBracket: vi.fn(),
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
} from "../actions";

const LEAGUE = "league_1";
const FIX = "fixture_abc";
const USER = "user_1";

const FIXTURE = {
  id: FIX,
  seasonId: "season_1",
  homeTeamId: "team_home",
  awayTeamId: "team_away",
  homeTeamName: "Home",
  awayTeamName: "Away",
  scheduledAt: null,
  week: 1,
  venue: null,
  status: "scheduled" as const,
  stage: "regular",
  createdAt: "2026-01-01T00:00:00.000Z",
  createdBy: USER,
};

function authorize() {
  mockSchedulesStandingsV1.mockResolvedValue(true);
  mockAuth.mockResolvedValue({ userId: USER });
  mockResolveOrgContext.mockResolvedValue({ visibleLeagueIds: [LEAGUE] });
  mockGetLeague.mockResolvedValue({ id: LEAGUE, name: "League" });
  mockGetLeagueOrgId.mockResolvedValue("org_1");
  mockResolveOrgRole.mockResolvedValue("org:admin");
  mockCanManageRoster.mockReturnValue(true);
  mockGetFixture.mockResolvedValue(FIXTURE);
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
      fixture: FIXTURE,
      orgContext: { visibleLeagueIds: [LEAGUE] },
      actorUserId: USER,
      decisive: false,
      profileCache: expect.any(Map),
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

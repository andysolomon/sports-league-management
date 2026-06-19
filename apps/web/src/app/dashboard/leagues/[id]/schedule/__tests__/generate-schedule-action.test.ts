import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockSchedulesStandingsV1,
  mockAuth,
  mockGetLeague,
  mockGetLeagueOrgId,
  mockResolveOrgContext,
  mockResolveOrgRole,
  mockCanManageRoster,
  mockGenerateSeasonSchedule,
} = vi.hoisted(() => ({
  mockSchedulesStandingsV1: vi.fn(),
  mockAuth: vi.fn(),
  mockGetLeague: vi.fn(),
  mockGetLeagueOrgId: vi.fn(),
  mockResolveOrgContext: vi.fn(),
  mockResolveOrgRole: vi.fn(),
  mockCanManageRoster: vi.fn(),
  mockGenerateSeasonSchedule: vi.fn(),
}));

vi.mock("@/lib/flags", () => ({
  schedulesStandingsV1: mockSchedulesStandingsV1,
}));
vi.mock("@clerk/nextjs/server", () => ({ auth: mockAuth }));
vi.mock("@/lib/data-api", () => ({
  generateSeasonSchedule: mockGenerateSeasonSchedule,
  getLeague: mockGetLeague,
  getLeagueOrgId: mockGetLeagueOrgId,
  // Unused by this action but imported by the module under test.
  createFixture: vi.fn(),
  deleteFixture: vi.fn(),
  recordGameResult: vi.fn(),
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

import { generateScheduleAction } from "../actions";

const LEAGUE = "league_1";
const SEASON = "season_1";

/** Put every gate in the "manager allowed" state. */
function authorize() {
  mockSchedulesStandingsV1.mockResolvedValue(true);
  mockAuth.mockResolvedValue({ userId: "user_1" });
  mockResolveOrgContext.mockResolvedValue({ visibleLeagueIds: [LEAGUE] });
  mockGetLeague.mockResolvedValue({ id: LEAGUE, name: "League" });
  mockGetLeagueOrgId.mockResolvedValue("org_1");
  mockResolveOrgRole.mockResolvedValue("org:admin");
  mockCanManageRoster.mockReturnValue(true);
}

describe("generateScheduleAction (WSM-000153)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generates a schedule for an authorized manager", async () => {
    authorize();
    mockGenerateSeasonSchedule.mockResolvedValue({
      created: 15,
      weeks: 5,
      teamCount: 6,
    });

    const res = await generateScheduleAction({
      leagueId: LEAGUE,
      seasonId: SEASON,
    });

    expect(res).toEqual({ ok: true, created: 15, weeks: 5, teamCount: 6 });
    expect(mockGenerateSeasonSchedule).toHaveBeenCalledWith({
      seasonId: SEASON,
      actorUserId: "user_1",
      confirm: undefined,
    });
  });

  it("returns needsConfirm when the slate has recorded results", async () => {
    authorize();
    mockGenerateSeasonSchedule.mockRejectedValue(
      new Error("Uncaught Error: schedule_has_results"),
    );

    const res = await generateScheduleAction({
      leagueId: LEAGUE,
      seasonId: SEASON,
    });

    expect(res).toEqual({ ok: false, needsConfirm: true });
  });

  it("passes confirm through to the mutation", async () => {
    authorize();
    mockGenerateSeasonSchedule.mockResolvedValue({
      created: 6,
      weeks: 3,
      teamCount: 4,
    });

    await generateScheduleAction({
      leagueId: LEAGUE,
      seasonId: SEASON,
      confirm: true,
    });

    expect(mockGenerateSeasonSchedule).toHaveBeenCalledWith({
      seasonId: SEASON,
      actorUserId: "user_1",
      confirm: true,
    });
  });

  it("rejects a caller who cannot manage rosters", async () => {
    authorize();
    mockCanManageRoster.mockReturnValue(false);

    const res = await generateScheduleAction({
      leagueId: LEAGUE,
      seasonId: SEASON,
    });

    expect(res).toEqual({ ok: false, error: "not_authorized" });
    expect(mockGenerateSeasonSchedule).not.toHaveBeenCalled();
  });

  it("rejects when the schedules flag is off", async () => {
    authorize();
    mockSchedulesStandingsV1.mockResolvedValue(false);

    const res = await generateScheduleAction({
      leagueId: LEAGUE,
      seasonId: SEASON,
    });

    expect(res).toEqual({ ok: false, error: "flag_disabled" });
    expect(mockGenerateSeasonSchedule).not.toHaveBeenCalled();
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockAuth,
  mockGetSeasonLeagueId,
  mockGetLeagueOrgId,
  mockGetUserRoleInOrg,
  mockCopySeasonRosters,
} = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockGetSeasonLeagueId: vi.fn(),
  mockGetLeagueOrgId: vi.fn(),
  mockGetUserRoleInOrg: vi.fn(),
  mockCopySeasonRosters: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: mockAuth }));
vi.mock("@/lib/data-api", () => ({
  copySeasonRosters: mockCopySeasonRosters,
  getSeasonLeagueId: mockGetSeasonLeagueId,
  getLeagueOrgId: mockGetLeagueOrgId,
  // Imported by the module under test but unused by this action.
  upsertSeason: vi.fn(),
  updateSeason: vi.fn(),
  setActiveSeason: vi.fn(),
  deleteSeason: vi.fn(),
  getSeasons: vi.fn(),
}));
vi.mock("@/lib/org-context", () => ({
  getUserRoleInOrg: mockGetUserRoleInOrg,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { copyRostersAction } from "../actions";

const LEAGUE = "league_1";
const SEASON = "season_1";

/** Put every gate in the "admin allowed" state. */
function authorize() {
  mockAuth.mockResolvedValue({ userId: "user_1" });
  mockGetSeasonLeagueId.mockResolvedValue(LEAGUE);
  mockGetLeagueOrgId.mockResolvedValue("org_1");
  mockGetUserRoleInOrg.mockResolvedValue("org:admin");
}

describe("copyRostersAction (WSM-000163)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("copies rosters for an authorized league admin", async () => {
    authorize();
    mockCopySeasonRosters.mockResolvedValue({
      copiedAssignments: 40,
      copiedDepthEntries: 22,
      sourceSeasonId: "season_prev",
    });

    const res = await copyRostersAction({ targetSeasonId: SEASON });

    expect(res).toEqual({
      ok: true,
      copiedAssignments: 40,
      copiedDepthEntries: 22,
    });
    expect(mockCopySeasonRosters).toHaveBeenCalledWith({
      targetSeasonId: SEASON,
      actorUserId: "user_1",
      confirm: undefined,
    });
  });

  it("returns needsConfirm when the target already has rosters", async () => {
    authorize();
    mockCopySeasonRosters.mockRejectedValue(
      new Error("Uncaught Error: target_has_rosters"),
    );

    const res = await copyRostersAction({ targetSeasonId: SEASON });

    expect(res).toEqual({ ok: false, needsConfirm: true });
  });

  it("passes confirm through to the mutation", async () => {
    authorize();
    mockCopySeasonRosters.mockResolvedValue({
      copiedAssignments: 1,
      copiedDepthEntries: 0,
      sourceSeasonId: "season_prev",
    });

    await copyRostersAction({ targetSeasonId: SEASON, confirm: true });

    expect(mockCopySeasonRosters).toHaveBeenCalledWith({
      targetSeasonId: SEASON,
      actorUserId: "user_1",
      confirm: true,
    });
  });

  it("maps no_source_season to a friendly error", async () => {
    authorize();
    mockCopySeasonRosters.mockRejectedValue(
      new Error("Uncaught Error: no_source_season"),
    );

    const res = await copyRostersAction({ targetSeasonId: SEASON });

    expect(res).toEqual({
      ok: false,
      error: "This league has no earlier season to copy rosters from.",
    });
  });

  it("rejects a non-admin caller", async () => {
    authorize();
    mockGetUserRoleInOrg.mockResolvedValue("org:member");

    const res = await copyRostersAction({ targetSeasonId: SEASON });

    expect(res).toEqual({ ok: false, error: "not_admin" });
    expect(mockCopySeasonRosters).not.toHaveBeenCalled();
  });

  it("rejects an unauthenticated caller", async () => {
    mockAuth.mockResolvedValue({ userId: null });

    const res = await copyRostersAction({ targetSeasonId: SEASON });

    expect(res).toEqual({ ok: false, error: "unauthorized" });
    expect(mockCopySeasonRosters).not.toHaveBeenCalled();
  });
});

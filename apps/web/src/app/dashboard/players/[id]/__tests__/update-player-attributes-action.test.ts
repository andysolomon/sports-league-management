import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockPlayerAttributesV1,
  mockAuth,
  mockGetPlayer,
  mockGetTeamLeagueId,
  mockGetLeagueOrgId,
  mockResolveOrgContext,
  mockResolveOrgRole,
  mockCanManageRoster,
  mockGetPlayerSeasonAttributes,
  mockUpdatePlayerAttributes,
} = vi.hoisted(() => ({
  mockPlayerAttributesV1: vi.fn(),
  mockAuth: vi.fn(),
  mockGetPlayer: vi.fn(),
  mockGetTeamLeagueId: vi.fn(),
  mockGetLeagueOrgId: vi.fn(),
  mockResolveOrgContext: vi.fn(),
  mockResolveOrgRole: vi.fn(),
  mockCanManageRoster: vi.fn(),
  mockGetPlayerSeasonAttributes: vi.fn(),
  mockUpdatePlayerAttributes: vi.fn(),
}));

vi.mock("@/lib/flags", () => ({
  playerAttributesV1: mockPlayerAttributesV1,
}));
vi.mock("@clerk/nextjs/server", () => ({ auth: mockAuth }));
vi.mock("@/lib/data-api", () => ({
  getPlayer: mockGetPlayer,
  getTeamLeagueId: mockGetTeamLeagueId,
  getLeagueOrgId: mockGetLeagueOrgId,
  getPlayerSeasonAttributes: mockGetPlayerSeasonAttributes,
  updatePlayerAttributes: mockUpdatePlayerAttributes,
}));
vi.mock("@/lib/org-context", () => ({
  resolveOrgContext: mockResolveOrgContext,
  resolveOrgRole: mockResolveOrgRole,
}));
vi.mock("@/lib/permissions", () => ({
  canManageRoster: mockCanManageRoster,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { updatePlayerAttributesAction } from "../actions";

const PLAYER_ID = "player_1";
const VALID_ATTRS = { SPD: 80, STR: 75, AGI: 82 };

function authorize(role: "admin" | "coach" | "viewer") {
  mockPlayerAttributesV1.mockResolvedValue(true);
  mockAuth.mockResolvedValue({ userId: "user_1" });
  mockResolveOrgContext.mockResolvedValue({ visibleLeagueIds: ["league_1"] });
  mockGetPlayer.mockResolvedValue({
    id: PLAYER_ID,
    teamId: "team_1",
    position: "QB",
  });
  mockGetTeamLeagueId.mockResolvedValue("league_1");
  mockGetLeagueOrgId.mockResolvedValue("org_1");
  mockResolveOrgRole.mockResolvedValue(role);
  mockGetPlayerSeasonAttributes.mockResolvedValue({
    weightedOverall: 78,
    attributes: VALID_ATTRS,
    positionGroup: "QB",
  });
  mockUpdatePlayerAttributes.mockResolvedValue({ id: "attr_1", created: false });
}

describe("updatePlayerAttributesAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects viewers", async () => {
    authorize("viewer");
    mockCanManageRoster.mockReturnValue(false);

    const res = await updatePlayerAttributesAction(PLAYER_ID, VALID_ATTRS);

    expect(res).toEqual({ ok: false, error: "not_authorized" });
    expect(mockUpdatePlayerAttributes).not.toHaveBeenCalled();
  });

  it("allows coaches", async () => {
    authorize("coach");
    mockCanManageRoster.mockReturnValue(true);

    const res = await updatePlayerAttributesAction(PLAYER_ID, VALID_ATTRS);

    expect(res).toEqual({ ok: true });
    expect(mockUpdatePlayerAttributes).toHaveBeenCalledWith(
      expect.objectContaining({
        playerId: PLAYER_ID,
        positionGroup: "QB",
      }),
    );
  });

  it("allows admins", async () => {
    authorize("admin");
    mockCanManageRoster.mockReturnValue(true);

    const res = await updatePlayerAttributesAction(PLAYER_ID, VALID_ATTRS);

    expect(res).toEqual({ ok: true });
    expect(mockUpdatePlayerAttributes).toHaveBeenCalled();
  });

  it("rejects invalid attribute values", async () => {
    authorize("coach");
    mockCanManageRoster.mockReturnValue(true);

    const res = await updatePlayerAttributesAction(PLAYER_ID, { SPD: 120 });

    expect(res.ok).toBe(false);
    if (res.ok) throw new Error("expected failure");
    expect(res.error).toMatch(/attribute_out_of_range/);
    expect(mockUpdatePlayerAttributes).not.toHaveBeenCalled();
  });

  it("rejects unknown attribute keys", async () => {
    authorize("coach");
    mockCanManageRoster.mockReturnValue(true);

    const res = await updatePlayerAttributesAction(PLAYER_ID, {
      NOT_A_REAL_KEY: 50,
    });

    expect(res.ok).toBe(false);
    if (res.ok) throw new Error("expected failure");
    expect(res.error).toMatch(/invalid_attribute_key/);
    expect(mockUpdatePlayerAttributes).not.toHaveBeenCalled();
  });
});

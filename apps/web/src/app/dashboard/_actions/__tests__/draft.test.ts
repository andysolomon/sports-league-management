import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockAuth,
  mockResolveOrgContext,
  mockResolveOrgRole,
  mockGetLeagueOrgId,
  mockStartDraft,
  mockMakeDraftPick,
  mockEndDraft,
} = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockResolveOrgContext: vi.fn(),
  mockResolveOrgRole: vi.fn(),
  mockGetLeagueOrgId: vi.fn(),
  mockStartDraft: vi.fn(),
  mockMakeDraftPick: vi.fn(),
  mockEndDraft: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: mockAuth }));
vi.mock("@/lib/org-context", () => ({
  resolveOrgContext: mockResolveOrgContext,
  resolveOrgRole: mockResolveOrgRole,
}));
vi.mock("@/lib/data-api", () => ({
  getLeagueOrgId: mockGetLeagueOrgId,
  startDraft: mockStartDraft,
  makeDraftPick: mockMakeDraftPick,
  endDraft: mockEndDraft,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import {
  startDraftAction,
  makeDraftPickAction,
  endDraftAction,
} from "../draft";

const USER = "user_1";
const ORG = "org_1";
const LEAGUE = "league_1";
const SEASON = "season_1";
const DRAFT = "draft_1";
const PLAYER = "player_1";

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ userId: USER });
  mockResolveOrgContext.mockResolvedValue({
    visibleLeagueIds: [LEAGUE],
    orgIds: [ORG],
  });
  mockGetLeagueOrgId.mockResolvedValue(ORG);
  mockStartDraft.mockResolvedValue({ draftId: DRAFT, order: ["t2", "t1"] });
  mockMakeDraftPick.mockResolvedValue({
    id: DRAFT,
    leagueId: LEAGUE,
    seasonId: SEASON,
    type: "snake",
    rounds: 3,
    order: ["t2", "t1"],
    status: "active",
    currentPick: 2,
    onClockTeamId: "t1",
    picks: [],
  });
  mockEndDraft.mockResolvedValue({ draftId: DRAFT, status: "complete" });
});

describe("startDraftAction", () => {
  it("allows an org admin", async () => {
    mockResolveOrgRole.mockResolvedValue("admin");

    const result = await startDraftAction({
      leagueId: LEAGUE,
      seasonId: SEASON,
    });
    expect(result).toEqual({
      ok: true,
      data: { draftId: DRAFT, order: ["t2", "t1"] },
    });
    expect(mockStartDraft).toHaveBeenCalledWith({
      leagueId: LEAGUE,
      seasonId: SEASON,
    });
  });

  it("rejects a coach (not org admin)", async () => {
    mockResolveOrgRole.mockResolvedValue("coach");

    const result = await startDraftAction({
      leagueId: LEAGUE,
      seasonId: SEASON,
    });
    expect(result).toEqual({ ok: false, error: "not_authorized" });
    expect(mockStartDraft).not.toHaveBeenCalled();
  });
});

describe("makeDraftPickAction", () => {
  it("allows an org admin", async () => {
    mockResolveOrgRole.mockResolvedValue("admin");

    const result = await makeDraftPickAction({
      draftId: DRAFT,
      playerId: PLAYER,
      leagueId: LEAGUE,
      seasonId: SEASON,
    });
    expect(result.ok).toBe(true);
    expect(mockMakeDraftPick).toHaveBeenCalledWith({
      draftId: DRAFT,
      playerId: PLAYER,
      actorUserId: USER,
    });
  });

  it("rejects a coach", async () => {
    mockResolveOrgRole.mockResolvedValue("coach");

    const result = await makeDraftPickAction({
      draftId: DRAFT,
      playerId: PLAYER,
      leagueId: LEAGUE,
      seasonId: SEASON,
    });
    expect(result).toEqual({ ok: false, error: "not_authorized" });
    expect(mockMakeDraftPick).not.toHaveBeenCalled();
  });
});

describe("endDraftAction", () => {
  it("allows an org admin", async () => {
    mockResolveOrgRole.mockResolvedValue("admin");

    const result = await endDraftAction({
      draftId: DRAFT,
      leagueId: LEAGUE,
      seasonId: SEASON,
    });
    expect(result).toEqual({
      ok: true,
      data: { draftId: DRAFT, status: "complete" },
    });
  });

  it("rejects a coach", async () => {
    mockResolveOrgRole.mockResolvedValue("coach");

    const result = await endDraftAction({
      draftId: DRAFT,
      leagueId: LEAGUE,
      seasonId: SEASON,
    });
    expect(result).toEqual({ ok: false, error: "not_authorized" });
    expect(mockEndDraft).not.toHaveBeenCalled();
  });
});

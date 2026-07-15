import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  redirect: vi.fn((to: string) => {
    throw new Error(`NEXT_REDIRECT:${to}`);
  }),
}));

vi.mock("@/lib/flags", () => ({
  liveScoringV1: vi.fn(),
}));

vi.mock("@/lib/authorization", () => ({
  canManageTeam: vi.fn(),
}));

vi.mock("@/lib/org-context", () => ({
  resolveOrgContext: vi.fn(),
}));

vi.mock("@/lib/active-league-server", () => ({
  syncActiveLeagueForResource: vi.fn(),
}));

vi.mock("@/lib/data-api", () => ({
  getTeam: vi.fn(),
  getFixture: vi.fn(),
  getLiveGameState: vi.fn(),
}));

import { auth } from "@clerk/nextjs/server";
import { canManageTeam } from "@/lib/authorization";
import { getFixture, getLiveGameState, getTeam } from "@/lib/data-api";
import { liveScoringV1 } from "@/lib/flags";
import { resolveOrgContext } from "@/lib/org-context";
import { syncActiveLeagueForResource } from "@/lib/active-league-server";
import LiveScoreboardPage from "../teams/[id]/games/[gameId]/live/page";

const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;
const mockCanManageTeam = canManageTeam as unknown as ReturnType<typeof vi.fn>;
const mockGetFixture = getFixture as unknown as ReturnType<typeof vi.fn>;
const mockGetLiveGameState = getLiveGameState as unknown as ReturnType<
  typeof vi.fn
>;
const mockGetTeam = getTeam as unknown as ReturnType<typeof vi.fn>;
const mockLiveScoringV1 = liveScoringV1 as unknown as ReturnType<typeof vi.fn>;
const mockResolveOrgContext = resolveOrgContext as unknown as ReturnType<
  typeof vi.fn
>;
const mockSyncActiveLeagueForResource =
  syncActiveLeagueForResource as unknown as ReturnType<typeof vi.fn>;

const params = Promise.resolve({ id: "team-1", gameId: "game-1" });

describe("resource page Active League synchronization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLiveScoringV1.mockResolvedValue(true);
    mockAuth.mockResolvedValue({ userId: "user-1" });
    mockResolveOrgContext.mockResolvedValue({
      userId: "user-1",
      orgIds: ["org-1"],
      visibleLeagueIds: ["league-1"],
    });
  });

  it("does not synchronize a role-inaccessible child route", async () => {
    mockCanManageTeam.mockResolvedValue(false);

    await expect(
      LiveScoreboardPage({ params }),
    ).rejects.toThrow("NEXT_NOT_FOUND");

    expect(mockSyncActiveLeagueForResource).not.toHaveBeenCalled();
    expect(mockResolveOrgContext).not.toHaveBeenCalled();
  });

  it("does not synchronize a game that does not belong to the route team", async () => {
    mockCanManageTeam.mockResolvedValue(true);
    mockGetTeam.mockResolvedValue({
      id: "team-1",
      name: "Team 1",
      leagueId: "league-1",
    });
    mockGetFixture.mockResolvedValue({
      id: "game-1",
      homeTeamId: "team-2",
      awayTeamId: "team-3",
    });

    await expect(
      LiveScoreboardPage({ params }),
    ).rejects.toThrow("NEXT_NOT_FOUND");

    expect(mockSyncActiveLeagueForResource).not.toHaveBeenCalled();
  });

  it("synchronizes only after all child-route access checks pass", async () => {
    mockCanManageTeam.mockResolvedValue(true);
    mockGetTeam.mockResolvedValue({
      id: "team-1",
      name: "Team 1",
      leagueId: "league-1",
    });
    mockGetFixture.mockResolvedValue({
      id: "game-1",
      homeTeamId: "team-1",
      awayTeamId: "team-2",
      homeTeamName: "Team 1",
      awayTeamName: "Team 2",
      week: 1,
    });
    mockGetLiveGameState.mockResolvedValue(null);

    await expect(LiveScoreboardPage({ params })).resolves.toBeTruthy();
    expect(mockSyncActiveLeagueForResource).toHaveBeenCalledWith("league-1");
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getLeagues,
  getLeague,
  getDivisions,
  getDivision,
  getTeams,
  getTeamsByLeague,
  getTeam,
  getPlayers,
  getPlayer,
  getPlayersByTeam,
  getSeasons,
  getSeason,
} from "../salesforce-api";
import type { OrgContext } from "../org-context";

const { mockQuery, mockMutation } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  mockMutation: vi.fn(),
}));

vi.mock("../convex-client", () => ({
  getConvexClient: vi.fn(() => ({
    query: mockQuery,
    mutation: mockMutation,
  })),
}));

const visibleCtx: OrgContext = {
  userId: "u1",
  orgIds: ["org_1"],
  visibleLeagueIds: ["lg_1", "lg_public"],
  subscribedLeagueIds: [],
};

const restrictedCtx: OrgContext = {
  userId: "u2",
  orgIds: [],
  visibleLeagueIds: ["lg_public"],
  subscribedLeagueIds: [],
};

describe("data-api scoped reads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getLeagues returns empty for an empty visible set", async () => {
    await expect(getLeagues([])).resolves.toEqual([]);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("getLeagues forwards visible league IDs to Convex", async () => {
    mockQuery.mockResolvedValue([
      { id: "lg_1", name: "My League", orgId: "org_1" },
      { id: "lg_public", name: "NFL", orgId: null },
    ]);

    const result = await getLeagues(["lg_1", "lg_public"]);
    expect(result).toHaveLength(2);
    expect(mockQuery).toHaveBeenCalledWith(expect.anything(), {
      leagueIds: ["lg_1", "lg_public"],
    });
  });

  it("getLeague rejects when the league is not visible", async () => {
    await expect(getLeague("lg_other", restrictedCtx)).rejects.toThrow(
      "You do not have access to this league",
    );
  });

  it("getLeague returns the league when Convex finds it", async () => {
    mockQuery.mockResolvedValue({ id: "lg_public", name: "NFL", orgId: null });
    await expect(getLeague("lg_public", restrictedCtx)).resolves.toEqual({
      id: "lg_public",
      name: "NFL",
      orgId: null,
    });
  });

  it("getDivision enforces access using the division leagueId", async () => {
    mockQuery.mockResolvedValue({ id: "d1", name: "AFC", leagueId: "lg_other" });
    await expect(getDivision("d1", restrictedCtx)).rejects.toThrow(
      "You do not have access to this league",
    );
  });

  it("getTeams and getPlayers return Convex collections for visible leagues", async () => {
    mockQuery
      .mockResolvedValueOnce([
        {
          id: "t1",
          name: "Team A",
          leagueId: "lg_1",
          city: "NYC",
          stadium: "Stadium 1",
          foundedYear: 2000,
          location: "NY",
          divisionId: "d1",
          logoUrl: null,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "p1",
          name: "Player 1",
          teamId: "t1",
          position: "QB",
          jerseyNumber: 12,
          dateOfBirth: "1990-01-01",
          status: "Active",
          headshotUrl: null,
        },
      ]);

    await expect(getTeams(["lg_1"])).resolves.toHaveLength(1);
    await expect(getPlayers(["lg_1"])).resolves.toHaveLength(1);
  });

  it("getPlayersByTeam rejects when the team league is not visible", async () => {
    mockQuery.mockResolvedValueOnce("lg_other");
    await expect(getPlayersByTeam("t1", restrictedCtx)).rejects.toThrow(
      "You do not have access to this league",
    );
  });

  it("getPlayer queries the player and the team league for access", async () => {
    mockQuery
      .mockResolvedValueOnce({
        id: "p1",
        name: "Player 1",
        teamId: "t1",
        position: "QB",
        jerseyNumber: 12,
        dateOfBirth: null,
        status: "Active",
        headshotUrl: null,
      })
      .mockResolvedValueOnce("lg_public");

    await expect(getPlayer("p1", restrictedCtx)).resolves.toMatchObject({
      id: "p1",
      teamId: "t1",
    });
  });

  it("getTeam and getSeason throw when Convex returns null", async () => {
    mockQuery.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    await expect(getTeam("missing_team", visibleCtx)).rejects.toThrow("Team not found");
    await expect(getSeason("missing_season", visibleCtx)).rejects.toThrow(
      "Season not found",
    );
  });

  it("getTeamsByLeague enforces league visibility before querying", async () => {
    await expect(getTeamsByLeague("lg_other", restrictedCtx)).rejects.toThrow(
      "You do not have access to this league",
    );
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("getSeasons forwards visible league IDs to Convex", async () => {
    mockQuery.mockResolvedValue([
      {
        id: "s1",
        name: "2025-26",
        leagueId: "lg_1",
        startDate: "2025-08-01",
        endDate: "2026-05-31",
        status: "Active",
      },
    ]);

    await expect(getSeasons(["lg_1"])).resolves.toHaveLength(1);
    expect(mockQuery).toHaveBeenCalledWith(expect.anything(), {
      leagueIds: ["lg_1"],
    });
  });
});

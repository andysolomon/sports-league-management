import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockQuery, mockSobjectCreate, mockSobjectUpdate } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  mockSobjectCreate: vi.fn(),
  mockSobjectUpdate: vi.fn(),
}));

vi.mock("../salesforce", () => ({
  getSalesforceConnection: vi.fn().mockResolvedValue({
    query: mockQuery,
    instanceUrl: "https://test.salesforce.com",
    request: vi.fn(),
    sobject: vi.fn().mockReturnValue({
      create: mockSobjectCreate,
      update: mockSobjectUpdate,
    }),
  }),
}));

vi.mock("../org-context", () => ({
  requireOrgAdmin: vi.fn(),
  requireLeagueAccess: vi.fn().mockImplementation((leagueId: string, ctx: { visibleLeagueIds: string[] }) => {
    if (!ctx.visibleLeagueIds.includes(leagueId)) {
      throw new Error("You do not have access to this league");
    }
  }),
}));

vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: vi.fn().mockResolvedValue({
    organizations: { createOrganization: vi.fn() },
    users: { getOrganizationMembershipList: vi.fn() },
  }),
}));

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

const visibleCtx: OrgContext = {
  userId: "u1",
  orgIds: ["org_1"],
  visibleLeagueIds: ["lg_1", "lg_public"],
};

const restrictedCtx: OrgContext = {
  userId: "u2",
  orgIds: [],
  visibleLeagueIds: ["lg_public"],
};

describe("org-scoped reads", () => {
  beforeEach(() => vi.clearAllMocks());

  // --- getLeagues ---

  it("getLeagues returns empty array for empty visibleLeagueIds", async () => {
    const result = await getLeagues([]);
    expect(result).toEqual([]);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("getLeagues queries with visible league IDs", async () => {
    mockQuery.mockResolvedValue({
      records: [
        { Id: "lg_1", Name: "My League", Clerk_Org_Id__c: "org_1" },
        { Id: "lg_public", Name: "NFL", Clerk_Org_Id__c: null },
      ],
    });

    const result = await getLeagues(["lg_1", "lg_public"]);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ id: "lg_1", name: "My League", orgId: "org_1" });
    expect(result[1]).toEqual({ id: "lg_public", name: "NFL", orgId: null });
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("WHERE Id IN ('lg_1','lg_public')"),
    );
  });

  // --- getLeague ---

  it("getLeague throws when league is not in visible set", async () => {
    await expect(getLeague("lg_other", restrictedCtx)).rejects.toThrow(
      "You do not have access to this league",
    );
  });

  it("getLeague returns league when accessible", async () => {
    mockQuery.mockResolvedValue({
      totalSize: 1,
      records: [{ Id: "lg_public", Name: "NFL", Clerk_Org_Id__c: null }],
    });

    const result = await getLeague("lg_public", restrictedCtx);
    expect(result).toEqual({ id: "lg_public", name: "NFL", orgId: null });
  });

  it("getLeague throws when league not found", async () => {
    mockQuery.mockResolvedValue({ totalSize: 0, records: [] });
    await expect(getLeague("lg_public", visibleCtx)).rejects.toThrow("League not found");
  });

  // --- getDivisions ---

  it("getDivisions returns empty array for empty visible set", async () => {
    const result = await getDivisions([]);
    expect(result).toEqual([]);
  });

  it("getDivisions filters by visible league IDs", async () => {
    mockQuery.mockResolvedValue({
      records: [{ Id: "d1", Name: "AFC", League__c: "lg_1" }],
    });

    const result = await getDivisions(["lg_1"]);
    expect(result).toEqual([{ id: "d1", name: "AFC", leagueId: "lg_1" }]);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("WHERE League__c IN"),
    );
  });

  // --- getDivision ---

  it("getDivision throws when division's league is not visible", async () => {
    mockQuery.mockResolvedValue({
      totalSize: 1,
      records: [{ Id: "d1", Name: "AFC", League__c: "lg_other" }],
    });

    await expect(getDivision("d1", restrictedCtx)).rejects.toThrow(
      "You do not have access to this league",
    );
  });

  // --- getTeams ---

  it("getTeams filters by visible league IDs", async () => {
    mockQuery.mockResolvedValue({
      records: [{
        Id: "t1", Name: "Team A", League__c: "lg_1", City__c: "NYC",
        Stadium__c: "Stadium 1", Founded_Year__c: 2000, Location__c: "NY",
        Division__c: "d1", Logo_URL__c: null,
      }],
    });

    const result = await getTeams(["lg_1"]);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Team A");
    expect(result[0].leagueId).toBe("lg_1");
  });

  // --- getTeamsByLeague ---

  it("getTeamsByLeague checks league access", async () => {
    await expect(getTeamsByLeague("lg_other", restrictedCtx)).rejects.toThrow(
      "You do not have access to this league",
    );
  });

  // --- getTeam ---

  it("getTeam checks league access via team's league", async () => {
    mockQuery.mockResolvedValue({
      totalSize: 1,
      records: [{
        Id: "t1", Name: "Team A", League__c: "lg_other", City__c: "NYC",
        Stadium__c: "S", Founded_Year__c: null, Location__c: "",
        Division__c: "d1", Logo_URL__c: null,
      }],
    });

    await expect(getTeam("t1", restrictedCtx)).rejects.toThrow(
      "You do not have access to this league",
    );
  });

  it("getTeam throws when team not found", async () => {
    mockQuery.mockResolvedValue({ totalSize: 0, records: [] });
    await expect(getTeam("t_none", visibleCtx)).rejects.toThrow("Team not found");
  });

  // --- getPlayers ---

  it("getPlayers filters by team's league via relationship query", async () => {
    mockQuery.mockResolvedValue({
      records: [{
        Id: "p1", Name: "Player 1", Team__c: "t1", Position__c: "QB",
        Jersey_Number__c: 12, Date_of_Birth__c: "1990-01-01", Status__c: "Active",
        Headshot_URL__c: null,
      }],
    });

    const result = await getPlayers(["lg_1"]);
    expect(result).toHaveLength(1);
    expect(result[0].position).toBe("QB");
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("Team__r.League__c IN"),
    );
  });

  // --- getPlayer ---

  it("getPlayer checks access via team relationship league", async () => {
    mockQuery.mockResolvedValue({
      totalSize: 1,
      records: [{
        Id: "p1", Name: "Player 1", Team__c: "t1", Position__c: "QB",
        Jersey_Number__c: 12, Date_of_Birth__c: null, Status__c: "Active",
        Headshot_URL__c: null, Team__r: { League__c: "lg_other" },
      }],
    });

    await expect(getPlayer("p1", restrictedCtx)).rejects.toThrow(
      "You do not have access to this league",
    );
  });

  it("getPlayer throws when player not found", async () => {
    mockQuery.mockResolvedValue({ totalSize: 0, records: [] });
    await expect(getPlayer("p_none", visibleCtx)).rejects.toThrow("Player not found");
  });

  // --- getPlayersByTeam ---

  it("getPlayersByTeam verifies team's league is accessible", async () => {
    mockQuery.mockResolvedValueOnce({
      totalSize: 1,
      records: [{ League__c: "lg_other" }],
    });

    await expect(getPlayersByTeam("t1", restrictedCtx)).rejects.toThrow(
      "You do not have access to this league",
    );
  });

  it("getPlayersByTeam throws when team not found", async () => {
    mockQuery.mockResolvedValue({ totalSize: 0, records: [] });
    await expect(getPlayersByTeam("t_none", visibleCtx)).rejects.toThrow("Team not found");
  });

  // --- getSeasons ---

  it("getSeasons returns empty for empty visible set", async () => {
    const result = await getSeasons([]);
    expect(result).toEqual([]);
  });

  it("getSeasons filters by visible league IDs", async () => {
    mockQuery.mockResolvedValue({
      records: [{
        Id: "s1", Name: "2025-26", League__c: "lg_1",
        Start_Date__c: "2025-08-01", End_Date__c: "2026-05-31", Status__c: "Active",
      }],
    });

    const result = await getSeasons(["lg_1"]);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: "s1", name: "2025-26", leagueId: "lg_1",
      startDate: "2025-08-01", endDate: "2026-05-31", status: "Active",
    });
  });

  // --- getSeason ---

  it("getSeason checks league access", async () => {
    mockQuery.mockResolvedValue({
      totalSize: 1,
      records: [{
        Id: "s1", Name: "2025-26", League__c: "lg_other",
        Start_Date__c: null, End_Date__c: null, Status__c: "Upcoming",
      }],
    });

    await expect(getSeason("s1", restrictedCtx)).rejects.toThrow(
      "You do not have access to this league",
    );
  });

  it("getSeason throws when season not found", async () => {
    mockQuery.mockResolvedValue({ totalSize: 0, records: [] });
    await expect(getSeason("s_none", visibleCtx)).rejects.toThrow("Season not found");
  });
});

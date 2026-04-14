import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetOrganizationMembershipList, mockQuery, mockGetUser } =
  vi.hoisted(() => ({
    mockGetOrganizationMembershipList: vi.fn(),
    mockQuery: vi.fn(),
    mockGetUser: vi.fn(),
  }));

vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: vi.fn().mockResolvedValue({
    users: {
      getOrganizationMembershipList: mockGetOrganizationMembershipList,
      getUser: mockGetUser,
    },
  }),
}));

vi.mock("../salesforce", () => ({
  getSalesforceConnection: vi.fn().mockResolvedValue({
    query: mockQuery,
  }),
}));

vi.mock("react", () => ({
  cache: (fn: Function) => fn,
}));

import {
  resolveOrgContext,
  requireLeagueAccess,
  requireOrgAdmin,
  getLeagueOrgId,
} from "../org-context";

describe("resolveOrgContext", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns visible league IDs for user with org memberships", async () => {
    mockGetOrganizationMembershipList.mockResolvedValue({
      data: [
        { organization: { id: "org_abc" } },
        { organization: { id: "org_def" } },
      ],
    });

    mockGetUser.mockResolvedValue({
      publicMetadata: { subscribedLeagueIds: [] },
    });

    mockQuery.mockResolvedValue({
      records: [{ Id: "league_1" }, { Id: "league_2" }],
    });

    const ctx = await resolveOrgContext("user_123");

    expect(ctx.userId).toBe("user_123");
    expect(ctx.orgIds).toEqual(["org_abc", "org_def"]);
    expect(ctx.visibleLeagueIds).toEqual(["league_1", "league_2"]);
    expect(ctx.subscribedLeagueIds).toEqual([]);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("org_abc"),
    );
    expect(mockQuery).not.toHaveBeenCalledWith(
      expect.stringContaining("Clerk_Org_Id__c = null"),
    );
  });

  it("returns empty visibleLeagueIds when no orgs and no subscriptions", async () => {
    mockGetOrganizationMembershipList.mockResolvedValue({ data: [] });
    mockGetUser.mockResolvedValue({
      publicMetadata: { subscribedLeagueIds: [] },
    });

    const ctx = await resolveOrgContext("user_no_orgs");

    expect(ctx.orgIds).toEqual([]);
    expect(ctx.visibleLeagueIds).toEqual([]);
    expect(ctx.subscribedLeagueIds).toEqual([]);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("includes subscribed public league IDs in visible set", async () => {
    mockGetOrganizationMembershipList.mockResolvedValue({ data: [] });
    mockGetUser.mockResolvedValue({
      publicMetadata: { subscribedLeagueIds: ["league_pub_1", "league_pub_2"] },
    });

    mockQuery.mockResolvedValue({
      records: [{ Id: "league_pub_1" }, { Id: "league_pub_2" }],
    });

    const ctx = await resolveOrgContext("user_with_subs");

    expect(ctx.orgIds).toEqual([]);
    expect(ctx.visibleLeagueIds).toEqual(["league_pub_1", "league_pub_2"]);
    expect(ctx.subscribedLeagueIds).toEqual([
      "league_pub_1",
      "league_pub_2",
    ]);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("Id IN"),
    );
  });

  it("combines org leagues and subscribed leagues", async () => {
    mockGetOrganizationMembershipList.mockResolvedValue({
      data: [{ organization: { id: "org_abc" } }],
    });
    mockGetUser.mockResolvedValue({
      publicMetadata: { subscribedLeagueIds: ["league_pub_1"] },
    });

    mockQuery.mockResolvedValue({
      records: [{ Id: "league_1" }, { Id: "league_pub_1" }],
    });

    const ctx = await resolveOrgContext("user_both");

    expect(ctx.orgIds).toEqual(["org_abc"]);
    expect(ctx.visibleLeagueIds).toEqual(["league_1", "league_pub_1"]);
    expect(ctx.subscribedLeagueIds).toEqual(["league_pub_1"]);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("Clerk_Org_Id__c IN"),
    );
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("Id IN"),
    );
  });

  it("handles pagination of org memberships", async () => {
    const firstPage = Array.from({ length: 100 }, (_, i) => ({
      organization: { id: `org_${i}` },
    }));
    const secondPage = [{ organization: { id: "org_100" } }];

    mockGetOrganizationMembershipList
      .mockResolvedValueOnce({ data: firstPage })
      .mockResolvedValueOnce({ data: secondPage });

    mockGetUser.mockResolvedValue({
      publicMetadata: { subscribedLeagueIds: [] },
    });

    mockQuery.mockResolvedValue({ records: [] });

    const ctx = await resolveOrgContext("user_many_orgs");

    expect(ctx.orgIds).toHaveLength(101);
    expect(mockGetOrganizationMembershipList).toHaveBeenCalledTimes(2);
  });

  it("handles missing publicMetadata gracefully", async () => {
    mockGetOrganizationMembershipList.mockResolvedValue({ data: [] });
    mockGetUser.mockResolvedValue({ publicMetadata: {} });

    const ctx = await resolveOrgContext("user_no_metadata");

    expect(ctx.subscribedLeagueIds).toEqual([]);
    expect(ctx.visibleLeagueIds).toEqual([]);
  });
});

describe("requireLeagueAccess", () => {
  it("does not throw when league is in visible set", () => {
    const ctx = {
      userId: "u1",
      orgIds: ["org_1"],
      visibleLeagueIds: ["lg_1", "lg_2"],
      subscribedLeagueIds: [],
    };
    expect(() => requireLeagueAccess("lg_1", ctx)).not.toThrow();
  });

  it("throws when league is not in visible set", () => {
    const ctx = {
      userId: "u1",
      orgIds: ["org_1"],
      visibleLeagueIds: ["lg_1"],
      subscribedLeagueIds: [],
    };
    expect(() => requireLeagueAccess("lg_other", ctx)).toThrow(
      "You do not have access to this league",
    );
  });
});

describe("requireOrgAdmin", () => {
  beforeEach(() => vi.clearAllMocks());

  it("does not throw when user is org admin", async () => {
    mockGetOrganizationMembershipList.mockResolvedValue({
      data: [{ organization: { id: "org_abc" }, role: "org:admin" }],
    });

    await expect(
      requireOrgAdmin("org_abc", "user_123"),
    ).resolves.toBeUndefined();
  });

  it("throws when user is not admin", async () => {
    mockGetOrganizationMembershipList.mockResolvedValue({
      data: [{ organization: { id: "org_abc" }, role: "org:member" }],
    });

    await expect(requireOrgAdmin("org_abc", "user_123")).rejects.toThrow(
      "You must be an admin",
    );
  });

  it("throws when user is not a member of the org at all", async () => {
    mockGetOrganizationMembershipList.mockResolvedValue({
      data: [{ organization: { id: "org_other" }, role: "org:admin" }],
    });

    await expect(requireOrgAdmin("org_abc", "user_123")).rejects.toThrow(
      "You must be an admin",
    );
  });
});

describe("getLeagueOrgId", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns org ID for a league with an org", async () => {
    mockQuery.mockResolvedValue({
      totalSize: 1,
      records: [{ Clerk_Org_Id__c: "org_abc" }],
    });

    const orgId = await getLeagueOrgId("league_1");
    expect(orgId).toBe("org_abc");
  });

  it("returns null for a public league", async () => {
    mockQuery.mockResolvedValue({
      totalSize: 1,
      records: [{ Clerk_Org_Id__c: null }],
    });

    const orgId = await getLeagueOrgId("league_public");
    expect(orgId).toBeNull();
  });

  it("throws when league not found", async () => {
    mockQuery.mockResolvedValue({ totalSize: 0, records: [] });

    await expect(getLeagueOrgId("nonexistent")).rejects.toThrow(
      "League not found",
    );
  });
});

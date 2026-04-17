import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockGetOrganizationMembershipList,
  mockGetUser,
  mockGetVisibleLeagueContext,
  mockSubscribeToLeague,
  mockGetLeagueOrgId,
} =
  vi.hoisted(() => ({
    mockGetOrganizationMembershipList: vi.fn(),
    mockGetUser: vi.fn(),
    mockGetVisibleLeagueContext: vi.fn(),
    mockSubscribeToLeague: vi.fn(),
    mockGetLeagueOrgId: vi.fn(),
  }));

vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: vi.fn().mockResolvedValue({
    users: {
      getOrganizationMembershipList: mockGetOrganizationMembershipList,
      getUser: mockGetUser,
    },
  }),
}));

vi.mock("../data-api", () => ({
  getVisibleLeagueContext: mockGetVisibleLeagueContext,
  subscribeToLeague: mockSubscribeToLeague,
  getLeagueOrgId: mockGetLeagueOrgId,
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
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetVisibleLeagueContext.mockReset();
    mockSubscribeToLeague.mockReset();
    mockGetLeagueOrgId.mockReset();
    mockGetOrganizationMembershipList.mockReset();
    mockGetUser.mockReset();
  });

  it("returns visible league IDs for user with org memberships", async () => {
    mockGetOrganizationMembershipList.mockResolvedValue({
      data: [
        { organization: { id: "org_abc" } },
        { organization: { id: "org_def" } },
      ],
    });

    mockGetUser.mockResolvedValue({
      publicMetadata: {},
    });
    mockGetVisibleLeagueContext.mockResolvedValue({
      visibleLeagueIds: ["league_1", "league_2"],
      subscribedLeagueIds: [],
    });

    const ctx = await resolveOrgContext("user_123");

    expect(ctx.userId).toBe("user_123");
    expect(ctx.orgIds).toEqual(["org_abc", "org_def"]);
    expect(ctx.visibleLeagueIds).toEqual(["league_1", "league_2"]);
    expect(ctx.subscribedLeagueIds).toEqual([]);
    expect(mockGetVisibleLeagueContext).toHaveBeenCalledWith("user_123", [
      "org_abc",
      "org_def",
    ]);
  });

  it("returns empty visibleLeagueIds when no orgs and no subscriptions", async () => {
    mockGetOrganizationMembershipList.mockResolvedValue({ data: [] });
    mockGetVisibleLeagueContext.mockResolvedValue({
      visibleLeagueIds: [],
      subscribedLeagueIds: [],
    });

    const ctx = await resolveOrgContext("user_no_orgs");

    expect(ctx.orgIds).toEqual([]);
    expect(ctx.visibleLeagueIds).toEqual([]);
    expect(ctx.subscribedLeagueIds).toEqual([]);
  });

  it("treats Clerk Forbidden on membership list as no orgs", async () => {
    mockGetOrganizationMembershipList.mockRejectedValue(
      new Error("Forbidden"),
    );
    mockGetVisibleLeagueContext.mockResolvedValue({
      visibleLeagueIds: [],
      subscribedLeagueIds: [],
    });

    const ctx = await resolveOrgContext("user_forbidden_orgs");

    expect(ctx.orgIds).toEqual([]);
    expect(ctx.visibleLeagueIds).toEqual([]);
  });

  it("includes subscribed public league IDs in visible set", async () => {
    mockGetOrganizationMembershipList.mockResolvedValue({ data: [] });
    mockGetVisibleLeagueContext.mockResolvedValue({
      visibleLeagueIds: ["league_pub_1", "league_pub_2"],
      subscribedLeagueIds: ["league_pub_1", "league_pub_2"],
    });

    const ctx = await resolveOrgContext("user_with_subs");

    expect(ctx.orgIds).toEqual([]);
    expect(ctx.visibleLeagueIds).toEqual(["league_pub_1", "league_pub_2"]);
    expect(ctx.subscribedLeagueIds).toEqual([
      "league_pub_1",
      "league_pub_2",
    ]);
  });

  it("combines org leagues and subscribed leagues", async () => {
    mockGetOrganizationMembershipList.mockResolvedValue({
      data: [{ organization: { id: "org_abc" } }],
    });
    mockGetVisibleLeagueContext.mockResolvedValue({
      visibleLeagueIds: ["league_1", "league_pub_1"],
      subscribedLeagueIds: ["league_pub_1"],
    });

    const ctx = await resolveOrgContext("user_both");

    expect(ctx.orgIds).toEqual(["org_abc"]);
    expect(ctx.visibleLeagueIds).toEqual(["league_1", "league_pub_1"]);
    expect(ctx.subscribedLeagueIds).toEqual(["league_pub_1"]);
  });

  it("handles pagination of org memberships", async () => {
    const firstPage = Array.from({ length: 100 }, (_, i) => ({
      organization: { id: `org_${i}` },
    }));
    const secondPage = [{ organization: { id: "org_100" } }];

    mockGetOrganizationMembershipList
      .mockResolvedValueOnce({ data: firstPage })
      .mockResolvedValueOnce({ data: secondPage });

    mockGetVisibleLeagueContext.mockResolvedValue({
      visibleLeagueIds: [],
      subscribedLeagueIds: [],
    });

    const ctx = await resolveOrgContext("user_many_orgs");

    expect(ctx.orgIds).toHaveLength(101);
    expect(mockGetOrganizationMembershipList).toHaveBeenCalledTimes(2);
    expect(mockGetVisibleLeagueContext).toHaveBeenCalledWith(
      "user_many_orgs",
      expect.arrayContaining(["org_0", "org_100"]),
    );
  });

  it("migrates legacy Clerk subscriptions into Convex on first read", async () => {
    mockGetOrganizationMembershipList.mockResolvedValue({ data: [] });
    mockGetVisibleLeagueContext
      .mockResolvedValueOnce({
        visibleLeagueIds: [],
        subscribedLeagueIds: [],
      })
      .mockResolvedValueOnce({
        visibleLeagueIds: ["league_pub_1"],
        subscribedLeagueIds: ["league_pub_1"],
      });
    mockGetUser.mockResolvedValue({
      publicMetadata: { subscribedLeagueIds: ["league_pub_1"] },
    });
    mockSubscribeToLeague.mockResolvedValue(undefined);

    const ctx = await resolveOrgContext("user_legacy");

    expect(mockSubscribeToLeague).toHaveBeenCalledWith(
      "user_legacy",
      "league_pub_1",
    );
    expect(ctx.subscribedLeagueIds).toEqual(["league_pub_1"]);
    expect(ctx.visibleLeagueIds).toEqual(["league_pub_1"]);
  });

  it("gracefully handles getUser Forbidden error", async () => {
    mockGetOrganizationMembershipList.mockResolvedValue({
      data: [{ organization: { id: "org_abc" } }],
    });
    mockGetVisibleLeagueContext.mockResolvedValue({
      visibleLeagueIds: ["league_1"],
      subscribedLeagueIds: [],
    });
    mockGetUser.mockRejectedValue(new Error("Forbidden"));

    const ctx = await resolveOrgContext("user_forbidden");

    expect(ctx.orgIds).toEqual(["org_abc"]);
    expect(ctx.visibleLeagueIds).toEqual(["league_1"]);
    expect(ctx.subscribedLeagueIds).toEqual([]);
  });

  it("returns org leagues when getUser throws and no subscriptions", async () => {
    mockGetOrganizationMembershipList.mockResolvedValue({ data: [] });
    mockGetVisibleLeagueContext.mockResolvedValue({
      visibleLeagueIds: [],
      subscribedLeagueIds: [],
    });
    mockGetUser.mockRejectedValue(new Error("Forbidden"));

    const ctx = await resolveOrgContext("user_no_access");

    expect(ctx.visibleLeagueIds).toEqual([]);
    expect(ctx.subscribedLeagueIds).toEqual([]);
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
    mockGetLeagueOrgId.mockResolvedValue("org_abc");

    const orgId = await getLeagueOrgId("league_1");
    expect(orgId).toBe("org_abc");
  });

  it("returns null for a public league", async () => {
    mockGetLeagueOrgId.mockResolvedValue(null);

    const orgId = await getLeagueOrgId("league_public");
    expect(orgId).toBeNull();
  });

  it("throws when league not found", async () => {
    mockGetLeagueOrgId.mockRejectedValue(new Error("League not found"));

    await expect(getLeagueOrgId("nonexistent")).rejects.toThrow(
      "League not found",
    );
  });
});

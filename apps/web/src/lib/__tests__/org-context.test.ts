import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockGetOrganizationMembershipList,
  mockGetVisibleLeagueContext,
} = vi.hoisted(() => ({
  mockGetOrganizationMembershipList: vi.fn(),
  mockGetVisibleLeagueContext: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: vi.fn().mockResolvedValue({
    users: {
      getOrganizationMembershipList: mockGetOrganizationMembershipList,
    },
  }),
}));

vi.mock("../data-api", () => ({
  getVisibleLeagueContext: mockGetVisibleLeagueContext,
}));

vi.mock("react", () => ({
  cache: (fn: Function) => fn,
}));

import {
  resolveOrgContext,
  requireLeagueAccess,
  requireOrgAdmin,
} from "../org-context";

describe("resolveOrgContext", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns visible + subscribed league IDs from Convex", async () => {
    mockGetOrganizationMembershipList.mockResolvedValue({
      data: [
        { organization: { id: "org_abc" } },
        { organization: { id: "org_def" } },
      ],
    });
    mockGetVisibleLeagueContext.mockResolvedValue({
      visibleLeagueIds: ["league_1", "league_2", "league_pub_1"],
      subscribedLeagueIds: ["league_pub_1"],
    });

    const ctx = await resolveOrgContext("user_123");

    expect(ctx.userId).toBe("user_123");
    expect(ctx.orgIds).toEqual(["org_abc", "org_def"]);
    expect(ctx.visibleLeagueIds).toEqual([
      "league_1",
      "league_2",
      "league_pub_1",
    ]);
    expect(ctx.subscribedLeagueIds).toEqual(["league_pub_1"]);
    expect(mockGetVisibleLeagueContext).toHaveBeenCalledWith("user_123", [
      "org_abc",
      "org_def",
    ]);
  });

  it("passes empty orgIds to Convex when user has no orgs", async () => {
    mockGetOrganizationMembershipList.mockResolvedValue({ data: [] });
    mockGetVisibleLeagueContext.mockResolvedValue({
      visibleLeagueIds: [],
      subscribedLeagueIds: [],
    });

    const ctx = await resolveOrgContext("user_no_orgs");

    expect(ctx.orgIds).toEqual([]);
    expect(ctx.visibleLeagueIds).toEqual([]);
    expect(ctx.subscribedLeagueIds).toEqual([]);
    expect(mockGetVisibleLeagueContext).toHaveBeenCalledWith(
      "user_no_orgs",
      [],
    );
  });

  it("subscriptions-only user gets visible IDs from Convex without org memberships", async () => {
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
      expect.arrayContaining(["org_0", "org_99", "org_100"]),
    );
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


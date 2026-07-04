import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const {
  mockGetOrganizationMembershipList,
  mockGetVisibleLeagueContext,
  mockGetOrgMemberRole,
} = vi.hoisted(() => ({
  mockGetOrganizationMembershipList: vi.fn(),
  mockGetVisibleLeagueContext: vi.fn(),
  mockGetOrgMemberRole: vi.fn(),
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
  getOrgMemberRole: mockGetOrgMemberRole,
}));

vi.mock("react", () => ({
  cache: (fn: Function) => fn,
}));

import {
  resolveOrgContext,
  requireLeagueAccess,
  requireOrgAdmin,
  getUserRoleInOrg,
  resolveBestOrgRole,
} from "../org-context";

/**
 * Mirrors what Clerk's backend SDK actually throws when the Organizations
 * feature is disabled on the instance (the WSM-000206 production incident):
 * a ClerkAPIResponseError carrying an `errors` array of machine-readable codes.
 */
function clerkOrgsDisabledError(): Error {
  const err = new Error(
    "The organizations feature is not enabled for this instance. If you believe this is a mistake, please contact support.",
  ) as Error & {
    clerkError: boolean;
    status: number;
    errors: Array<{ code: string; message: string }>;
  };
  err.clerkError = true;
  err.status = 403;
  err.errors = [
    {
      code: "organization_not_enabled_in_instance",
      message: "The organizations feature is not enabled for this instance.",
    },
  ];
  return err;
}

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
      subscriptionScopes: [
        { leagueId: "league_pub_1", teamIds: ["team_a", "team_b"] },
      ],
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
    // À la carte scopes map leagueId → imported teamIds (WSM-000100).
    expect(ctx.subscriptionTeamScopes).toEqual({
      league_pub_1: ["team_a", "team_b"],
    });
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
      subscriptionScopes: [],
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
      subscriptionScopes: [],
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
      subscriptionScopes: [],
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
      subscriptionTeamScopes: {},
    };
    expect(() => requireLeagueAccess("lg_1", ctx)).not.toThrow();
  });

  it("throws when league is not in visible set", () => {
    const ctx = {
      userId: "u1",
      orgIds: ["org_1"],
      visibleLeagueIds: ["lg_1"],
      subscribedLeagueIds: [],
      subscriptionTeamScopes: {},
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

// WSM-000206 / #456: the production Clerk instance lacked the Organizations
// feature, so getOrganizationMembershipList threw a 403 ClerkAPIResponseError
// and the unhandled throw 500'd the entire dashboard. The org-context layer
// must fail SOFT: log one structured line and degrade to the same values a
// user with no organizations gets.
describe("Clerk org-API failure degrades gracefully (WSM-000206)", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe("resolveOrgContext", () => {
    it("returns the no-org context instead of throwing when Clerk orgs are disabled", async () => {
      mockGetOrganizationMembershipList.mockRejectedValue(
        clerkOrgsDisabledError(),
      );
      mockGetVisibleLeagueContext.mockResolvedValue({
        visibleLeagueIds: [],
        subscribedLeagueIds: [],
        subscriptionScopes: [],
      });

      const ctx = await resolveOrgContext("user_123");

      // Exactly the shape dashboard/page.tsx consumes: it reads
      // ctx.visibleLeagueIds to fetch leagues, and with an empty array the
      // page renders the "No leagues yet" empty-workspace bento — not a 500.
      expect(ctx).toEqual({
        userId: "user_123",
        orgIds: [],
        visibleLeagueIds: [],
        subscribedLeagueIds: [],
        subscriptionTeamScopes: {},
      });
    });

    it("still resolves subscribed public leagues via Convex when Clerk fails", async () => {
      mockGetOrganizationMembershipList.mockRejectedValue(
        clerkOrgsDisabledError(),
      );
      mockGetVisibleLeagueContext.mockResolvedValue({
        visibleLeagueIds: ["league_pub_1"],
        subscribedLeagueIds: ["league_pub_1"],
        subscriptionScopes: [],
      });

      const ctx = await resolveOrgContext("user_with_subs");

      // Same degradation as a no-org user: Convex is still consulted with an
      // empty org list, so subscriptions keep working.
      expect(mockGetVisibleLeagueContext).toHaveBeenCalledWith(
        "user_with_subs",
        [],
      );
      expect(ctx.visibleLeagueIds).toEqual(["league_pub_1"]);
      expect(ctx.subscribedLeagueIds).toEqual(["league_pub_1"]);
    });

    it("logs one structured JSON line including the Clerk error code", async () => {
      mockGetOrganizationMembershipList.mockRejectedValue(
        clerkOrgsDisabledError(),
      );
      mockGetVisibleLeagueContext.mockResolvedValue({
        visibleLeagueIds: [],
        subscribedLeagueIds: [],
        subscriptionScopes: [],
      });

      await resolveOrgContext("user_123");

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      const logged = JSON.parse(consoleErrorSpy.mock.calls[0][0] as string);
      expect(logged).toMatchObject({
        level: "error",
        source: "org-context",
        clerkErrorCode: "organization_not_enabled_in_instance",
        userId: "user_123",
      });
    });

    it("degrades on non-Clerk errors too, with a null error code", async () => {
      mockGetOrganizationMembershipList.mockRejectedValue(
        new Error("socket hang up"),
      );
      mockGetVisibleLeagueContext.mockResolvedValue({
        visibleLeagueIds: [],
        subscribedLeagueIds: [],
        subscriptionScopes: [],
      });

      const ctx = await resolveOrgContext("user_123");

      expect(ctx.orgIds).toEqual([]);
      const logged = JSON.parse(consoleErrorSpy.mock.calls[0][0] as string);
      expect(logged.clerkErrorCode).toBeNull();
    });
  });

  describe("resolveBestOrgRole", () => {
    it("returns null (no role anywhere) when Clerk orgs are disabled", async () => {
      mockGetOrganizationMembershipList.mockRejectedValue(
        clerkOrgsDisabledError(),
      );

      await expect(
        resolveBestOrgRole(["org_league", "org_owner"], "user_123"),
      ).resolves.toBeNull();
    });

    it("happy path unchanged: strongest role across candidate orgs wins", async () => {
      mockGetOrganizationMembershipList.mockResolvedValue({
        data: [
          { organization: { id: "org_league" }, role: "org:member" },
          { organization: { id: "org_owner" }, role: "org:admin" },
        ],
      });
      mockGetOrgMemberRole.mockResolvedValue(null);

      await expect(
        resolveBestOrgRole(["org_league", "org_owner"], "user_123"),
      ).resolves.toBe("admin");
    });
  });

  describe("getUserRoleInOrg", () => {
    it("returns null when Clerk orgs are disabled", async () => {
      mockGetOrganizationMembershipList.mockRejectedValue(
        clerkOrgsDisabledError(),
      );

      await expect(
        getUserRoleInOrg("org_abc", "user_123"),
      ).resolves.toBeNull();
    });

    it("happy path unchanged: returns the raw Clerk role", async () => {
      mockGetOrganizationMembershipList.mockResolvedValue({
        data: [{ organization: { id: "org_abc" }, role: "org:admin" }],
      });

      await expect(getUserRoleInOrg("org_abc", "user_123")).resolves.toBe(
        "org:admin",
      );
    });
  });

  describe("requireOrgAdmin", () => {
    it("fails CLOSED with the controlled admin error (never the raw Clerk crash)", async () => {
      mockGetOrganizationMembershipList.mockRejectedValue(
        clerkOrgsDisabledError(),
      );

      await expect(requireOrgAdmin("org_abc", "user_123")).rejects.toThrow(
        "You must be an admin",
      );
    });
  });
});


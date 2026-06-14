import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockGetTeamLeagueId,
  mockGetLeagueOrgId,
  mockGetTeamOwnerOrgId,
  mockClaimTeam,
  mockGetOrgMemberRole,
  mockGetOrganizationMembershipList,
} = vi.hoisted(() => ({
  mockGetTeamLeagueId: vi.fn(),
  mockGetLeagueOrgId: vi.fn(),
  mockGetTeamOwnerOrgId: vi.fn(),
  mockClaimTeam: vi.fn(),
  mockGetOrgMemberRole: vi.fn(),
  mockGetOrganizationMembershipList: vi.fn(),
}));

vi.mock("../data-api", () => ({
  getTeamLeagueId: mockGetTeamLeagueId,
  getLeagueOrgId: mockGetLeagueOrgId,
  getTeamOwnerOrgId: mockGetTeamOwnerOrgId,
  claimTeam: mockClaimTeam,
  getOrgMemberRole: mockGetOrgMemberRole,
  getVisibleLeagueContext: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn().mockResolvedValue({ userId: "user_1" }),
  currentUser: vi.fn().mockResolvedValue({ publicMetadata: {} }),
  clerkClient: vi.fn().mockResolvedValue({
    users: {
      getOrganizationMembershipList: mockGetOrganizationMembershipList,
      getUser: vi.fn().mockResolvedValue({ privateMetadata: {} }),
    },
  }),
}));

import { authorizeTeamMutation, canManageTeam } from "../authorization";

describe("authorizeTeamMutation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: team is unclaimed and members carry no sub-role (→ viewer)
    // unless a test says otherwise.
    mockGetTeamOwnerOrgId.mockResolvedValue(null);
    mockGetOrgMemberRole.mockResolvedValue(null);
  });

  it("returns not authorized when team is not found", async () => {
    mockGetTeamLeagueId.mockRejectedValue(new Error("Team not found"));

    const result = await authorizeTeamMutation("team_missing", "user_1");

    expect(result).toEqual({ userId: "user_1", role: null, isAuthorized: false });
  });

  it("returns not authorized for public league (null orgId)", async () => {
    mockGetTeamLeagueId.mockResolvedValue("league_1");
    mockGetLeagueOrgId.mockResolvedValue(null);

    const result = await authorizeTeamMutation("team_1", "user_1");

    expect(result).toEqual({ userId: "user_1", role: null, isAuthorized: false });
  });

  it("returns authorized for org admin", async () => {
    mockGetTeamLeagueId.mockResolvedValue("league_1");
    mockGetLeagueOrgId.mockResolvedValue("org_1");
    mockGetOrganizationMembershipList.mockResolvedValue({
      data: [{ organization: { id: "org_1" }, role: "org:admin" }],
    });

    const result = await authorizeTeamMutation("team_1", "user_1");

    expect(result).toEqual({
      userId: "user_1",
      role: "admin",
      isAuthorized: true,
    });
  });

  it("authorizes a coach (org member with coach sub-role)", async () => {
    mockGetTeamLeagueId.mockResolvedValue("league_1");
    mockGetLeagueOrgId.mockResolvedValue("org_1");
    mockGetOrganizationMembershipList.mockResolvedValue({
      data: [{ organization: { id: "org_1" }, role: "org:member" }],
    });
    mockGetOrgMemberRole.mockResolvedValue("coach");

    const result = await authorizeTeamMutation("team_1", "user_1");

    expect(result).toEqual({
      userId: "user_1",
      role: "coach",
      isAuthorized: true,
    });
  });

  it("denies a viewer (org member, no sub-role)", async () => {
    mockGetTeamLeagueId.mockResolvedValue("league_1");
    mockGetLeagueOrgId.mockResolvedValue("org_1");
    mockGetOrganizationMembershipList.mockResolvedValue({
      data: [{ organization: { id: "org_1" }, role: "org:member" }],
    });

    const result = await authorizeTeamMutation("team_1", "user_1");

    expect(result).toEqual({
      userId: "user_1",
      role: "viewer",
      isAuthorized: false,
    });
  });

  it("returns not authorized for non-member of org", async () => {
    mockGetTeamLeagueId.mockResolvedValue("league_1");
    mockGetLeagueOrgId.mockResolvedValue("org_1");
    mockGetOrganizationMembershipList.mockResolvedValue({
      data: [{ organization: { id: "org_other" }, role: "org:admin" }],
    });

    const result = await authorizeTeamMutation("team_1", "user_1");

    expect(result).toEqual({ userId: "user_1", role: null, isAuthorized: false });
  });

  // WSM-000109/121: a forked team in a shared/public league is editable by an
  // admin (or coach) of the org that owns it, even though the league org is null.
  it("authorizes an admin of the team's owner org (forked team)", async () => {
    mockGetTeamLeagueId.mockResolvedValue("league_pub");
    mockGetLeagueOrgId.mockResolvedValue(null); // public template league
    mockGetTeamOwnerOrgId.mockResolvedValue("org_coach");
    mockGetOrganizationMembershipList.mockResolvedValue({
      data: [{ organization: { id: "org_coach" }, role: "org:admin" }],
    });

    const result = await authorizeTeamMutation("team_forked", "user_1");

    expect(result).toEqual({
      userId: "user_1",
      role: "admin",
      isAuthorized: true,
    });
  });

  it("denies a viewer member of the team's owner org", async () => {
    mockGetTeamLeagueId.mockResolvedValue("league_pub");
    mockGetLeagueOrgId.mockResolvedValue(null);
    mockGetTeamOwnerOrgId.mockResolvedValue("org_coach");
    mockGetOrganizationMembershipList.mockResolvedValue({
      data: [{ organization: { id: "org_coach" }, role: "org:member" }],
    });

    const result = await authorizeTeamMutation("team_forked", "user_1");

    expect(result).toEqual({
      userId: "user_1",
      role: "viewer",
      isAuthorized: false,
    });
  });
});

describe("canManageTeam", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns true when user is authorized", async () => {
    mockGetTeamLeagueId.mockResolvedValue("league_1");
    mockGetLeagueOrgId.mockResolvedValue("org_1");
    mockGetOrganizationMembershipList.mockResolvedValue({
      data: [{ organization: { id: "org_1" }, role: "org:admin" }],
    });

    const result = await canManageTeam("team_1", "user_1");

    expect(result).toBe(true);
  });

  it("returns false when user is not authorized", async () => {
    mockGetTeamLeagueId.mockRejectedValue(new Error("Team not found"));

    const result = await canManageTeam("team_missing", "user_1");

    expect(result).toBe(false);
  });
});

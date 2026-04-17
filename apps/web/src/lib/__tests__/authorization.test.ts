import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockGetTeamLeagueId,
  mockGetLeagueOrgId,
  mockGetOrganizationMembershipList,
} = vi.hoisted(() => ({
  mockGetTeamLeagueId: vi.fn(),
  mockGetLeagueOrgId: vi.fn(),
  mockGetOrganizationMembershipList: vi.fn(),
}));

vi.mock("../data-api", () => ({
  getTeamLeagueId: mockGetTeamLeagueId,
}));

vi.mock("../org-context", () => ({
  getLeagueOrgId: mockGetLeagueOrgId,
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
  });

  it("returns not authorized when team is not found", async () => {
    mockGetTeamLeagueId.mockRejectedValue(new Error("Team not found"));

    const result = await authorizeTeamMutation("team_missing", "user_1");

    expect(result).toEqual({ userId: "user_1", isAuthorized: false });
  });

  it("returns not authorized for public league (null orgId)", async () => {
    mockGetTeamLeagueId.mockResolvedValue("league_1");
    mockGetLeagueOrgId.mockResolvedValue(null);

    const result = await authorizeTeamMutation("team_1", "user_1");

    expect(result).toEqual({ userId: "user_1", isAuthorized: false });
  });

  it("returns authorized for org admin", async () => {
    mockGetTeamLeagueId.mockResolvedValue("league_1");
    mockGetLeagueOrgId.mockResolvedValue("org_1");
    mockGetOrganizationMembershipList.mockResolvedValue({
      data: [{ organization: { id: "org_1" }, role: "org:admin" }],
    });

    const result = await authorizeTeamMutation("team_1", "user_1");

    expect(result).toEqual({ userId: "user_1", isAuthorized: true });
  });

  it("returns not authorized for org member (non-admin)", async () => {
    mockGetTeamLeagueId.mockResolvedValue("league_1");
    mockGetLeagueOrgId.mockResolvedValue("org_1");
    mockGetOrganizationMembershipList.mockResolvedValue({
      data: [{ organization: { id: "org_1" }, role: "org:member" }],
    });

    const result = await authorizeTeamMutation("team_1", "user_1");

    expect(result).toEqual({ userId: "user_1", isAuthorized: false });
  });

  it("returns not authorized for non-member of org", async () => {
    mockGetTeamLeagueId.mockResolvedValue("league_1");
    mockGetLeagueOrgId.mockResolvedValue("org_1");
    mockGetOrganizationMembershipList.mockResolvedValue({
      data: [{ organization: { id: "org_other" }, role: "org:admin" }],
    });

    const result = await authorizeTeamMutation("team_1", "user_1");

    expect(result).toEqual({ userId: "user_1", isAuthorized: false });
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

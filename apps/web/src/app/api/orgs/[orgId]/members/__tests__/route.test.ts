import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const {
  mockAuth,
  mockRequireOrgAdmin,
  mockGetMembershipList,
  mockUpdateMembership,
  mockDeleteMembership,
} = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockRequireOrgAdmin: vi.fn(),
  mockGetMembershipList: vi.fn(),
  mockUpdateMembership: vi.fn(),
  mockDeleteMembership: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: mockAuth,
  clerkClient: vi.fn().mockResolvedValue({
    organizations: {
      getOrganizationMembershipList: mockGetMembershipList,
      updateOrganizationMembership: mockUpdateMembership,
      deleteOrganizationMembership: mockDeleteMembership,
    },
  }),
}));

vi.mock("@/lib/org-context", () => ({
  requireOrgAdmin: mockRequireOrgAdmin,
}));

vi.mock("@/lib/data-api", () => ({
  listOrgMemberRoles: vi.fn().mockResolvedValue([]),
  setOrgMemberRole: vi.fn().mockResolvedValue(undefined),
  deleteOrgMemberRole: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/api-error", () => ({
  handleApiError: vi.fn().mockReturnValue(
    new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
    }),
  ),
}));

import { GET, PATCH, DELETE } from "../route";

const mockMembers = {
  data: [
    {
      publicUserData: {
        userId: "user_1",
        identifier: "admin@test.com",
        firstName: "Admin",
        lastName: "User",
        imageUrl: "",
      },
      role: "org:admin",
      createdAt: Date.now(),
    },
    {
      publicUserData: {
        userId: "user_2",
        identifier: "member@test.com",
        firstName: "Member",
        lastName: "User",
        imageUrl: "",
      },
      role: "org:member",
      createdAt: Date.now(),
    },
  ],
};

function makeParams(orgId: string) {
  return { params: Promise.resolve({ orgId }) };
}

function makeRequest(body?: unknown): NextRequest {
  if (body) {
    return new NextRequest("http://localhost/api/orgs/org_1/members", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    });
  }
  return new NextRequest("http://localhost/api/orgs/org_1/members");
}

describe("Members API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ userId: "user_1" });
    mockRequireOrgAdmin.mockResolvedValue(undefined);
    mockGetMembershipList.mockResolvedValue(mockMembers);
  });

  describe("GET", () => {
    it("returns 401 when unauthenticated", async () => {
      mockAuth.mockResolvedValue({ userId: null });
      const res = await GET(makeRequest(), makeParams("org_1"));
      expect(res.status).toBe(401);
    });

    it("returns 403 for non-admin", async () => {
      mockRequireOrgAdmin.mockRejectedValue(
        new Error("You must be an admin of this league to make changes"),
      );
      const res = await GET(makeRequest(), makeParams("org_1"));
      expect(res.status).toBe(403);
    });

    it("returns member list", async () => {
      const res = await GET(makeRequest(), makeParams("org_1"));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveLength(2);
      expect(data[0].email).toBe("admin@test.com");
      // Effective capability roles: org:admin → admin; org:member with no
      // sub-role → viewer (WSM-000121).
      expect(data[0].role).toBe("admin");
      expect(data[1].role).toBe("viewer");
    });
  });

  describe("PATCH", () => {
    it("returns 400 for invalid params", async () => {
      const res = await PATCH(
        makeRequest({ memberUserId: "user_2" }),
        makeParams("org_1"),
      );
      expect(res.status).toBe(400);
    });

    it("returns 400 for an unknown role", async () => {
      const res = await PATCH(
        makeRequest({ memberUserId: "user_2", role: "org:member" }),
        makeParams("org_1"),
      );
      expect(res.status).toBe(400);
    });

    it("returns 400 when demoting last admin", async () => {
      const res = await PATCH(
        makeRequest({ memberUserId: "user_1", role: "viewer" }),
        makeParams("org_1"),
      );
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe("Cannot demote the last admin");
    });

    it("returns 200 promoting a member to admin", async () => {
      mockUpdateMembership.mockResolvedValue({});
      const res = await PATCH(
        makeRequest({ memberUserId: "user_2", role: "admin" }),
        makeParams("org_1"),
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it("returns 200 setting a member to coach", async () => {
      mockUpdateMembership.mockResolvedValue({});
      const res = await PATCH(
        makeRequest({ memberUserId: "user_2", role: "coach" }),
        makeParams("org_1"),
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });
  });

  describe("DELETE", () => {
    it("returns 400 when removing last admin", async () => {
      const res = await DELETE(
        makeRequest({ memberUserId: "user_1" }),
        makeParams("org_1"),
      );
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe("Cannot remove the last admin");
    });

    it("returns 200 on member removal", async () => {
      mockDeleteMembership.mockResolvedValue({});
      const res = await DELETE(
        makeRequest({ memberUserId: "user_2" }),
        makeParams("org_1"),
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });
  });
});

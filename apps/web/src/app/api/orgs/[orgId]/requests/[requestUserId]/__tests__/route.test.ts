import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockAuth,
  mockRequireOrgAdmin,
  mockRemovePendingRequest,
  mockCreateOrganizationMembership,
} = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockRequireOrgAdmin: vi.fn(),
  mockRemovePendingRequest: vi.fn(),
  mockCreateOrganizationMembership: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: mockAuth,
  clerkClient: vi.fn().mockResolvedValue({
    organizations: {
      createOrganizationMembership: mockCreateOrganizationMembership,
    },
  }),
}));

vi.mock("@/lib/org-context", () => ({
  requireOrgAdmin: mockRequireOrgAdmin,
}));

vi.mock("@/lib/org-requests", () => ({
  removePendingRequest: mockRemovePendingRequest,
}));

vi.mock("@/lib/api-error", () => ({
  handleApiError: vi.fn().mockReturnValue(
    new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 }),
  ),
}));

import { POST, DELETE } from "../route";
import { NextRequest } from "next/server";

function makeParams(orgId: string, requestUserId: string) {
  return { params: Promise.resolve({ orgId, requestUserId }) };
}

function makeRequest(method: string) {
  return new NextRequest(
    `http://localhost/api/orgs/org_1/requests/user_2`,
    { method },
  );
}

describe("POST /api/orgs/[orgId]/requests/[requestUserId] (approve)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const res = await POST(makeRequest("POST"), makeParams("org_1", "user_2"));
    expect(res.status).toBe(401);
  });

  it("returns 403 when not admin", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    mockRequireOrgAdmin.mockRejectedValue(
      new Error("You must be an admin of this league to make changes"),
    );

    const res = await POST(makeRequest("POST"), makeParams("org_1", "user_2"));
    expect(res.status).toBe(403);
  });

  it("approves request and creates membership", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    mockRequireOrgAdmin.mockResolvedValue(undefined);
    mockCreateOrganizationMembership.mockResolvedValue({});
    mockRemovePendingRequest.mockResolvedValue(undefined);

    const res = await POST(makeRequest("POST"), makeParams("org_1", "user_2"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("approved");
    expect(mockCreateOrganizationMembership).toHaveBeenCalledWith({
      organizationId: "org_1",
      userId: "user_2",
      role: "org:member",
    });
    expect(mockRemovePendingRequest).toHaveBeenCalledWith("org_1", "user_2");
  });
});

describe("DELETE /api/orgs/[orgId]/requests/[requestUserId] (reject)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const res = await DELETE(makeRequest("DELETE"), makeParams("org_1", "user_2"));
    expect(res.status).toBe(401);
  });

  it("returns 403 when not admin", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    mockRequireOrgAdmin.mockRejectedValue(
      new Error("You must be an admin of this league to make changes"),
    );

    const res = await DELETE(makeRequest("DELETE"), makeParams("org_1", "user_2"));
    expect(res.status).toBe(403);
  });

  it("rejects request and removes pending request", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    mockRequireOrgAdmin.mockResolvedValue(undefined);
    mockRemovePendingRequest.mockResolvedValue(undefined);

    const res = await DELETE(makeRequest("DELETE"), makeParams("org_1", "user_2"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("rejected");
    expect(mockRemovePendingRequest).toHaveBeenCalledWith("org_1", "user_2");
  });
});

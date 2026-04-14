import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockAuth,
  mockRequireOrgAdmin,
  mockGetPendingRequests,
  mockAddPendingRequest,
  mockGetOrganizationMembershipList,
  mockGetUser,
} = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockRequireOrgAdmin: vi.fn(),
  mockGetPendingRequests: vi.fn(),
  mockAddPendingRequest: vi.fn(),
  mockGetOrganizationMembershipList: vi.fn(),
  mockGetUser: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: mockAuth,
  clerkClient: vi.fn().mockResolvedValue({
    users: {
      getOrganizationMembershipList: mockGetOrganizationMembershipList,
      getUser: mockGetUser,
    },
  }),
}));

vi.mock("@/lib/org-context", () => ({
  requireOrgAdmin: mockRequireOrgAdmin,
}));

vi.mock("@/lib/org-requests", () => ({
  getPendingRequests: mockGetPendingRequests,
  addPendingRequest: mockAddPendingRequest,
}));

vi.mock("@/lib/api-error", () => ({
  handleApiError: vi.fn().mockReturnValue(
    new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 }),
  ),
}));

import { GET, POST } from "../route";
import { NextRequest } from "next/server";

function makeParams(orgId: string) {
  return { params: Promise.resolve({ orgId }) };
}

function makeRequest(method: string = "GET") {
  return new NextRequest(`http://localhost/api/orgs/org_1/requests`, {
    method,
    ...(method === "POST" && {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }),
  });
}

describe("GET /api/orgs/[orgId]/requests", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const res = await GET(makeRequest(), makeParams("org_1"));
    expect(res.status).toBe(401);
  });

  it("returns 403 when not admin", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    mockRequireOrgAdmin.mockRejectedValue(
      new Error("You must be an admin of this league to make changes"),
    );

    const res = await GET(makeRequest(), makeParams("org_1"));
    expect(res.status).toBe(403);
  });

  it("returns pending requests for admin", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    mockRequireOrgAdmin.mockResolvedValue(undefined);
    mockGetPendingRequests.mockResolvedValue([
      { userId: "user_2", email: "a@b.com", requestedAt: "2025-01-01T00:00:00.000Z" },
    ]);

    const res = await GET(makeRequest(), makeParams("org_1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0]).toEqual({
      userId: "user_2",
      email: "a@b.com",
      requestedAt: "2025-01-01T00:00:00.000Z",
    });
  });
});

describe("POST /api/orgs/[orgId]/requests", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const res = await POST(makeRequest("POST"), makeParams("org_1"));
    expect(res.status).toBe(401);
  });

  it("returns 400 when already a member", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    mockGetOrganizationMembershipList.mockResolvedValue({
      data: [{ organization: { id: "org_1" } }],
    });

    const res = await POST(makeRequest("POST"), makeParams("org_1"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Already a member");
  });

  it("returns 201 and submits request", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    mockGetOrganizationMembershipList.mockResolvedValue({ data: [] });
    mockGetUser.mockResolvedValue({
      emailAddresses: [{ emailAddress: "test@example.com" }],
    });
    mockAddPendingRequest.mockResolvedValue(undefined);

    const res = await POST(makeRequest("POST"), makeParams("org_1"));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.message).toBe("Request submitted");
    expect(mockAddPendingRequest).toHaveBeenCalledWith("org_1", "user_1", "test@example.com");
  });
});

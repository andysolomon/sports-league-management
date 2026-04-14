import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockAuth, mockRequireOrgAdmin, mockGetInvitationList, mockCreateInvitation } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockRequireOrgAdmin: vi.fn(),
  mockGetInvitationList: vi.fn(),
  mockCreateInvitation: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: mockAuth,
  clerkClient: vi.fn().mockResolvedValue({
    organizations: {
      getOrganizationInvitationList: mockGetInvitationList,
      createOrganizationInvitation: mockCreateInvitation,
    },
  }),
}));

vi.mock("@/lib/org-context", () => ({
  requireOrgAdmin: mockRequireOrgAdmin,
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

function makeRequest(body?: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/orgs/org_1/invitations", {
    method: body ? "POST" : "GET",
    ...(body && {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  });
}

describe("GET /api/orgs/[orgId]/invitations", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const res = await GET(makeRequest(), makeParams("org_1"));
    expect(res.status).toBe(401);
  });

  it("returns 403 when not admin", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    mockRequireOrgAdmin.mockRejectedValue(new Error("You must be an admin of this league to make changes"));

    const res = await GET(makeRequest(), makeParams("org_1"));
    expect(res.status).toBe(403);
  });

  it("returns invitation list for admin", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    mockRequireOrgAdmin.mockResolvedValue(undefined);
    mockGetInvitationList.mockResolvedValue({
      data: [
        { id: "inv_1", emailAddress: "a@b.com", status: "pending", createdAt: 1700000000000 },
        { id: "inv_2", emailAddress: "c@d.com", status: "accepted", createdAt: 1700100000000 },
      ],
    });

    const res = await GET(makeRequest(), makeParams("org_1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(2);
    expect(body[0]).toEqual({
      id: "inv_1",
      emailAddress: "a@b.com",
      status: "pending",
      createdAt: 1700000000000,
    });
  });
});

describe("POST /api/orgs/[orgId]/invitations", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const res = await POST(makeRequest({ emailAddress: "a@b.com" }), makeParams("org_1"));
    expect(res.status).toBe(401);
  });

  it("returns 403 when not admin", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    mockRequireOrgAdmin.mockRejectedValue(new Error("You must be an admin of this league to make changes"));

    const res = await POST(makeRequest({ emailAddress: "a@b.com" }), makeParams("org_1"));
    expect(res.status).toBe(403);
  });

  it("returns 400 for invalid email", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    mockRequireOrgAdmin.mockResolvedValue(undefined);

    const res = await POST(makeRequest({ emailAddress: "not-an-email" }), makeParams("org_1"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Valid email address is required");
  });

  it("returns 201 and creates invitation", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    mockRequireOrgAdmin.mockResolvedValue(undefined);
    mockCreateInvitation.mockResolvedValue({
      id: "inv_new",
      emailAddress: "new@example.com",
      status: "pending",
      createdAt: 1700200000000,
    });

    const res = await POST(makeRequest({ emailAddress: "new@example.com" }), makeParams("org_1"));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toEqual({
      id: "inv_new",
      emailAddress: "new@example.com",
      status: "pending",
      createdAt: 1700200000000,
    });
    expect(mockCreateInvitation).toHaveBeenCalledWith({
      organizationId: "org_1",
      emailAddress: "new@example.com",
      role: "org:member",
      inviterUserId: "user_1",
    });
  });
});

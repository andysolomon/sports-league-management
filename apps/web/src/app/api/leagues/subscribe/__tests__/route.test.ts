import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockAuth, mockQuery, mockGetUser, mockUpdateUser } = vi.hoisted(
  () => ({
    mockAuth: vi.fn(),
    mockQuery: vi.fn(),
    mockGetUser: vi.fn(),
    mockUpdateUser: vi.fn(),
  }),
);

vi.mock("@clerk/nextjs/server", () => ({
  auth: mockAuth,
  clerkClient: vi.fn().mockResolvedValue({
    users: {
      getUser: mockGetUser,
      updateUser: mockUpdateUser,
    },
  }),
}));

vi.mock("@/lib/salesforce", () => ({
  getSalesforceConnection: vi.fn().mockResolvedValue({
    query: mockQuery,
  }),
}));

vi.mock("@/lib/api-error", () => ({
  handleApiError: vi.fn().mockImplementation((error: unknown, route: string) => {
    const { NextResponse } = require("next/server");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }),
}));

import { POST, DELETE } from "../route";
import { NextRequest } from "next/server";

function makeRequest(body: unknown, method = "POST"): NextRequest {
  return new NextRequest("http://localhost/api/leagues/subscribe", {
    method,
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/leagues/subscribe", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });

    const res = await POST(makeRequest({ leagueId: "lg_1" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when leagueId is missing", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });

    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it("returns 404 when league is not public", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    mockQuery.mockResolvedValue({ totalSize: 0, records: [] });

    const res = await POST(makeRequest({ leagueId: "lg_private" }));
    expect(res.status).toBe(404);
  });

  it("returns 200 and subscribes successfully", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    mockQuery.mockResolvedValue({
      totalSize: 1,
      records: [{ Id: "lg_pub" }],
    });
    mockGetUser.mockResolvedValue({
      publicMetadata: { subscribedLeagueIds: [] },
    });
    mockUpdateUser.mockResolvedValue({});

    const res = await POST(makeRequest({ leagueId: "lg_pub" }));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.message).toBe("Subscribed");
    expect(mockUpdateUser).toHaveBeenCalledWith("user_1", {
      publicMetadata: { subscribedLeagueIds: ["lg_pub"] },
    });
  });

  it("returns 200 when already subscribed (idempotent)", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    mockQuery.mockResolvedValue({
      totalSize: 1,
      records: [{ Id: "lg_pub" }],
    });
    mockGetUser.mockResolvedValue({
      publicMetadata: { subscribedLeagueIds: ["lg_pub"] },
    });

    const res = await POST(makeRequest({ leagueId: "lg_pub" }));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.message).toBe("Already subscribed");
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/leagues/subscribe", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });

    const res = await DELETE(makeRequest({ leagueId: "lg_1" }, "DELETE"));
    expect(res.status).toBe(401);
  });

  it("returns 200 and unsubscribes successfully", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    mockGetUser.mockResolvedValue({
      publicMetadata: { subscribedLeagueIds: ["lg_pub", "lg_other"] },
    });
    mockUpdateUser.mockResolvedValue({});

    const res = await DELETE(makeRequest({ leagueId: "lg_pub" }, "DELETE"));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.message).toBe("Unsubscribed");
    expect(mockUpdateUser).toHaveBeenCalledWith("user_1", {
      publicMetadata: { subscribedLeagueIds: ["lg_other"] },
    });
  });
});

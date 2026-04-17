import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockAuth,
  mockGetPublicLeagues,
  mockSubscribeToLeague,
  mockUnsubscribeFromLeague,
} = vi.hoisted(
  () => ({
    mockAuth: vi.fn(),
    mockGetPublicLeagues: vi.fn(),
    mockSubscribeToLeague: vi.fn(),
    mockUnsubscribeFromLeague: vi.fn(),
  }),
);

vi.mock("@clerk/nextjs/server", () => ({
  auth: mockAuth,
}));

vi.mock("@/lib/data-api", () => ({
  getPublicLeagues: mockGetPublicLeagues,
  subscribeToLeague: mockSubscribeToLeague,
  unsubscribeFromLeague: mockUnsubscribeFromLeague,
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
    mockGetPublicLeagues.mockResolvedValue([]);

    const res = await POST(makeRequest({ leagueId: "lg_private" }));
    expect(res.status).toBe(404);
  });

  it("returns 200 and subscribes successfully", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    mockGetPublicLeagues.mockResolvedValue([
      { id: "lg_pub", name: "NFL", orgId: null },
    ]);

    const res = await POST(makeRequest({ leagueId: "lg_pub" }));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.message).toBe("Subscribed");
    expect(mockSubscribeToLeague).toHaveBeenCalledWith("user_1", "lg_pub");
  });

  it("returns 200 when subscribe is repeated", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    mockGetPublicLeagues.mockResolvedValue([
      { id: "lg_pub", name: "NFL", orgId: null },
    ]);

    const res = await POST(makeRequest({ leagueId: "lg_pub" }));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.message).toBe("Subscribed");
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

    const res = await DELETE(makeRequest({ leagueId: "lg_pub" }, "DELETE"));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.message).toBe("Unsubscribed");
    expect(mockUnsubscribeFromLeague).toHaveBeenCalledWith("user_1", "lg_pub");
  });
});

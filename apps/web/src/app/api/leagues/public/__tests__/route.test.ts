import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockAuth, mockGetPublicLeagues } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockGetPublicLeagues: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: mockAuth,
}));

vi.mock("@/lib/salesforce-api", () => ({
  getPublicLeagues: mockGetPublicLeagues,
}));

vi.mock("@/lib/api-error", () => ({
  handleApiError: vi.fn().mockImplementation((error: unknown, route: string) => {
    const { NextResponse } = require("next/server");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }),
}));

import { GET } from "../route";

describe("GET /api/leagues/public", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });

    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns 200 with public leagues", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    mockGetPublicLeagues.mockResolvedValue([
      { id: "lg_1", name: "NFL", orgId: null },
      { id: "lg_2", name: "NBA", orgId: null },
    ]);

    const res = await GET();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toEqual([
      { id: "lg_1", name: "NFL", orgId: null },
      { id: "lg_2", name: "NBA", orgId: null },
    ]);
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));
vi.mock("@/lib/salesforce-api", () => ({ getDivisions: vi.fn() }));
vi.mock("@/lib/api-error", () => ({
  handleApiError: vi.fn(() => {
    const { NextResponse } = require("next/server");
    return NextResponse.json({ error: "internal" }, { status: 503 });
  }),
}));

import { auth } from "@clerk/nextjs/server";
import { getDivisions } from "@/lib/salesforce-api";
import { GET } from "../route";

const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;
const mockGetDivisions = getDivisions as unknown as ReturnType<typeof vi.fn>;

describe("GET /api/cli/divisions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null, tokenType: null });
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns all divisions", async () => {
    mockAuth.mockResolvedValue({ userId: "u1", tokenType: "session_token" });
    mockGetDivisions.mockResolvedValue([
      { id: "d1", name: "East", leagueId: "lg1" },
      { id: "d2", name: "West", leagueId: "lg1" },
    ]);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(2);
  });
});

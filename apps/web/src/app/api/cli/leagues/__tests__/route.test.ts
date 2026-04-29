import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
}));
vi.mock("@/lib/data-api", () => ({
  getLeagues: vi.fn(),
}));
vi.mock("@/lib/org-context", () => ({
  resolveOrgContext: vi.fn(),
}));
vi.mock("@/lib/api-error", () => ({
  handleApiError: vi.fn((_err: unknown, _ctx: string) => {
    const { NextResponse } = require("next/server");
    return NextResponse.json({ error: "internal" }, { status: 503 });
  }),
}));

import { auth } from "@clerk/nextjs/server";
import { getLeagues } from "@/lib/data-api";
import { resolveOrgContext } from "@/lib/org-context";
import { GET } from "../route";

const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;
const mockGetLeagues = getLeagues as unknown as ReturnType<typeof vi.fn>;
const mockResolveOrgContext = resolveOrgContext as unknown as ReturnType<typeof vi.fn>;

const fakeOrgContext = {
  userId: "user_123",
  orgIds: ["org_1"],
  visibleLeagueIds: ["league_1", "league_2"],
};

describe("GET /api/cli/leagues", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null, tokenType: null });
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns league data for an authenticated request", async () => {
    mockAuth.mockResolvedValue({ userId: "user_123", tokenType: "api_key" });
    mockResolveOrgContext.mockResolvedValue(fakeOrgContext);
    mockGetLeagues.mockResolvedValue([
      { id: "league_1", name: "Premier League", orgId: "org_1" },
      { id: "league_2", name: "La Liga", orgId: null },
    ]);

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(2);
    expect(body[0].name).toBe("Premier League");
    expect(mockGetLeagues).toHaveBeenCalledWith(fakeOrgContext.visibleLeagueIds);
  });

  it("returns 503 when Salesforce fails", async () => {
    mockAuth.mockResolvedValue({
      userId: "user_123",
      tokenType: "session_token",
    });
    mockResolveOrgContext.mockResolvedValue(fakeOrgContext);
    mockGetLeagues.mockRejectedValue(new Error("SF connection failed"));

    const res = await GET();
    expect(res.status).toBe(503);
  });
});

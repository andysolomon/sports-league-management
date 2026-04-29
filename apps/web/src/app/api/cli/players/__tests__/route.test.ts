import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));
vi.mock("@/lib/data-api", () => ({ getPlayersByTeam: vi.fn() }));
vi.mock("@/lib/org-context", () => ({ resolveOrgContext: vi.fn() }));
vi.mock("@/lib/api-error", () => ({
  handleApiError: vi.fn(() => {
    const { NextResponse } = require("next/server");
    return NextResponse.json({ error: "internal" }, { status: 503 });
  }),
}));

import { auth } from "@clerk/nextjs/server";
import { getPlayersByTeam } from "@/lib/data-api";
import { resolveOrgContext } from "@/lib/org-context";
import { GET } from "../route";

const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;
const mockGetPlayers = getPlayersByTeam as unknown as ReturnType<typeof vi.fn>;
const mockResolveOrgContext = resolveOrgContext as unknown as ReturnType<typeof vi.fn>;

const fakeOrgContext = {
  userId: "u1",
  orgIds: ["org_1"],
  visibleLeagueIds: ["lg_1"],
};

function req(url: string) {
  return new NextRequest(new URL(url, "http://localhost:3000"));
}

describe("GET /api/cli/players", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null, tokenType: null });
    const res = await GET(req("/api/cli/players?teamId=t1"));
    expect(res.status).toBe(401);
  });

  it("returns 400 when teamId is missing", async () => {
    mockAuth.mockResolvedValue({ userId: "u1", tokenType: "api_key" });
    const res = await GET(req("/api/cli/players"));
    expect(res.status).toBe(400);
  });

  it("returns players filtered by team", async () => {
    mockAuth.mockResolvedValue({ userId: "u1", tokenType: "api_key" });
    mockResolveOrgContext.mockResolvedValue(fakeOrgContext);
    mockGetPlayers.mockResolvedValue([
      { id: "p1", name: "Player 1", position: "GK", jerseyNumber: 1, status: "Active" },
    ]);
    const res = await GET(req("/api/cli/players?teamId=t1"));
    expect(res.status).toBe(200);
    expect(mockGetPlayers).toHaveBeenCalledWith("t1", fakeOrgContext);
  });
});

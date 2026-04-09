import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
}));
vi.mock("@/lib/salesforce-api", () => ({
  getTeams: vi.fn(),
  getTeamsByLeague: vi.fn(),
  createTeam: vi.fn(),
}));
vi.mock("@/lib/api-error", () => ({
  handleApiError: vi.fn((_err: unknown, _ctx: string) => {
    const { NextResponse } = require("next/server");
    return NextResponse.json({ error: "internal" }, { status: 503 });
  }),
}));

import { auth } from "@clerk/nextjs/server";
import { getTeams, getTeamsByLeague, createTeam } from "@/lib/salesforce-api";
import { GET, POST } from "../route";

const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;
const mockGetTeams = getTeams as unknown as ReturnType<typeof vi.fn>;
const mockGetTeamsByLeague = getTeamsByLeague as unknown as ReturnType<
  typeof vi.fn
>;
const mockCreateTeam = createTeam as unknown as ReturnType<typeof vi.fn>;

function makeRequest(url: string) {
  return new NextRequest(new URL(url, "http://localhost:3000"));
}

describe("GET /api/cli/teams", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null, tokenType: null });
    const res = await GET(makeRequest("/api/cli/teams"));
    expect(res.status).toBe(401);
  });

  it("returns all teams when no leagueId filter", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1", tokenType: "api_key" });
    mockGetTeams.mockResolvedValue([
      { id: "t1", name: "Team A", city: "NYC", stadium: "Stadium 1" },
    ]);

    const res = await GET(makeRequest("/api/cli/teams"));
    expect(res.status).toBe(200);
    expect(mockGetTeams).toHaveBeenCalled();
    expect(mockGetTeamsByLeague).not.toHaveBeenCalled();
  });

  it("filters by leagueId when query param is present", async () => {
    mockAuth.mockResolvedValue({
      userId: "user_1",
      tokenType: "session_token",
    });
    mockGetTeamsByLeague.mockResolvedValue([
      { id: "t2", name: "Team B", city: "LA", stadium: "Stadium 2" },
    ]);

    const res = await GET(makeRequest("/api/cli/teams?leagueId=lg_1"));
    expect(res.status).toBe(200);
    expect(mockGetTeamsByLeague).toHaveBeenCalledWith("lg_1");
    expect(mockGetTeams).not.toHaveBeenCalled();
  });

  it("returns 503 on Salesforce failure", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1", tokenType: "api_key" });
    mockGetTeams.mockRejectedValue(new Error("SF down"));

    const res = await GET(makeRequest("/api/cli/teams"));
    expect(res.status).toBe(503);
  });
});

function makePostRequest(body: unknown) {
  return new NextRequest(new URL("/api/cli/teams", "http://localhost:3000"), {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/cli/teams", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null, tokenType: null });
    const res = await POST(
      makePostRequest({ name: "Test", leagueId: "lg1", city: "NYC", stadium: "S1" }),
    );
    expect(res.status).toBe(401);
  });

  it("creates a team and returns 201", async () => {
    mockAuth.mockResolvedValue({ userId: "u1", tokenType: "api_key" });
    mockCreateTeam.mockResolvedValue({
      id: "t_new",
      name: "New Team",
      leagueId: "lg1",
      city: "NYC",
      stadium: "S1",
    });

    const res = await POST(
      makePostRequest({ name: "New Team", leagueId: "lg1", city: "NYC", stadium: "S1" }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.name).toBe("New Team");
    expect(mockCreateTeam).toHaveBeenCalledWith({
      name: "New Team",
      leagueId: "lg1",
      city: "NYC",
      stadium: "S1",
    });
  });
});

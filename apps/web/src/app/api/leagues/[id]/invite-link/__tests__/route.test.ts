import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockRequireOrgAdmin: vi.fn(),
  mockGetLeagueInviteInfo: vi.fn(),
  mockSetLeagueInviteToken: vi.fn(),
  mockHandleApiError: vi.fn((_err: unknown, _route?: string) => {
    const { NextResponse } = require("next/server");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }),
  mockRandomUUID: vi.fn(() => "test-uuid-1234"),
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: mocks.mockAuth,
}));

vi.mock("@/lib/org-context", () => ({
  requireOrgAdmin: mocks.mockRequireOrgAdmin,
}));

vi.mock("@/lib/data-api", () => ({
  getLeagueInviteInfo: mocks.mockGetLeagueInviteInfo,
  setLeagueInviteToken: mocks.mockSetLeagueInviteToken,
}));

vi.mock("@/lib/api-error", () => ({
  handleApiError: mocks.mockHandleApiError,
}));

vi.mock("crypto", () => ({
  default: { randomUUID: mocks.mockRandomUUID },
  randomUUID: mocks.mockRandomUUID,
}));

import { GET, POST, DELETE } from "../route";
import { NextRequest } from "next/server";

function makeRequest(method: string) {
  return new NextRequest("http://localhost:3000/api/leagues/league_1/invite-link", {
    method,
  });
}

const params = Promise.resolve({ id: "league_1" });

describe("league invite-link API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET", () => {
    it("returns 401 when unauthenticated", async () => {
      mocks.mockAuth.mockResolvedValue({ userId: null });

      const res = await GET(makeRequest("GET"), { params });
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toBe("Unauthorized");
    });

    it("returns 404 when the league does not exist", async () => {
      mocks.mockAuth.mockResolvedValue({ userId: "user_1" });
      mocks.mockGetLeagueInviteInfo.mockResolvedValue(null);

      const res = await GET(makeRequest("GET"), { params });
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toBe("League not found");
      expect(mocks.mockRequireOrgAdmin).not.toHaveBeenCalled();
    });

    it("returns 404 for a league no org owns", async () => {
      mocks.mockAuth.mockResolvedValue({ userId: "user_1" });
      mocks.mockGetLeagueInviteInfo.mockResolvedValue({ orgId: null, token: null });

      const res = await GET(makeRequest("GET"), { params });
      expect(res.status).toBe(404);
      expect(mocks.mockRequireOrgAdmin).not.toHaveBeenCalled();
    });

    it("returns 403 for non-admin of the owning org", async () => {
      mocks.mockAuth.mockResolvedValue({ userId: "user_1" });
      mocks.mockGetLeagueInviteInfo.mockResolvedValue({ orgId: "org_123", token: null });
      mocks.mockRequireOrgAdmin.mockRejectedValue(new Error("User must be an admin"));

      const res = await GET(makeRequest("GET"), { params });
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toBe("Forbidden");
      expect(mocks.mockRequireOrgAdmin).toHaveBeenCalledWith("org_123", "user_1");
    });

    it("returns null when no invite link exists", async () => {
      mocks.mockAuth.mockResolvedValue({ userId: "user_1" });
      mocks.mockGetLeagueInviteInfo.mockResolvedValue({ orgId: "org_123", token: null });
      mocks.mockRequireOrgAdmin.mockResolvedValue(undefined);

      const res = await GET(makeRequest("GET"), { params });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.url).toBeNull();
      expect(body.token).toBeNull();
    });

    it("returns invite link URL when token exists", async () => {
      mocks.mockAuth.mockResolvedValue({ userId: "user_1" });
      mocks.mockGetLeagueInviteInfo.mockResolvedValue({ orgId: "org_123", token: "abc-123" });
      mocks.mockRequireOrgAdmin.mockResolvedValue(undefined);

      const res = await GET(makeRequest("GET"), { params });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.url).toBe("/join/abc-123");
      expect(body.token).toBe("abc-123");
    });
  });

  describe("POST", () => {
    it("generates a new token for the league and returns 201", async () => {
      mocks.mockAuth.mockResolvedValue({ userId: "user_1" });
      mocks.mockGetLeagueInviteInfo.mockResolvedValue({ orgId: "org_123", token: null });
      mocks.mockRequireOrgAdmin.mockResolvedValue(undefined);
      mocks.mockSetLeagueInviteToken.mockResolvedValue(undefined);

      const res = await POST(makeRequest("POST"), { params });
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.url).toBe("/join/test-uuid-1234");
      expect(body.token).toBe("test-uuid-1234");
      expect(mocks.mockSetLeagueInviteToken).toHaveBeenCalledWith("league_1", "test-uuid-1234");
    });

    it("returns 404 for a league no org owns without writing", async () => {
      mocks.mockAuth.mockResolvedValue({ userId: "user_1" });
      mocks.mockGetLeagueInviteInfo.mockResolvedValue({ orgId: null, token: null });

      const res = await POST(makeRequest("POST"), { params });
      expect(res.status).toBe(404);
      expect(mocks.mockSetLeagueInviteToken).not.toHaveBeenCalled();
    });
  });

  describe("DELETE", () => {
    it("revokes the league's token", async () => {
      mocks.mockAuth.mockResolvedValue({ userId: "user_1" });
      mocks.mockGetLeagueInviteInfo.mockResolvedValue({ orgId: "org_123", token: "abc-123" });
      mocks.mockRequireOrgAdmin.mockResolvedValue(undefined);
      mocks.mockSetLeagueInviteToken.mockResolvedValue(undefined);

      const res = await DELETE(makeRequest("DELETE"), { params });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(mocks.mockSetLeagueInviteToken).toHaveBeenCalledWith("league_1", null);
    });
  });
});

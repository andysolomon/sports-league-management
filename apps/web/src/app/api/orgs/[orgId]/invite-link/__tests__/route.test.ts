import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => {
  return {
    mockAuth: vi.fn(),
    mockRequireOrgAdmin: vi.fn(),
    mockHandleApiError: vi.fn((_err: unknown, _route?: string) => {
      const { NextResponse } = require("next/server");
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }),
    mockGetLeagueForOrg: vi.fn(),
    mockSetLeagueInviteToken: vi.fn(),
    mockRandomUUID: vi.fn(() => "test-uuid-1234"),
  };
});

vi.mock("@clerk/nextjs/server", () => ({
  auth: mocks.mockAuth,
}));

vi.mock("@/lib/org-context", () => ({
  requireOrgAdmin: mocks.mockRequireOrgAdmin,
}));

vi.mock("@/lib/data-api", () => ({
  getLeagueForOrg: mocks.mockGetLeagueForOrg,
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
  return new NextRequest("http://localhost:3000/api/orgs/org_123/invite-link", { method });
}

const params = Promise.resolve({ orgId: "org_123" });

describe("invite-link API", () => {
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

    it("returns 403 for non-admin", async () => {
      mocks.mockAuth.mockResolvedValue({ userId: "user_1" });
      mocks.mockRequireOrgAdmin.mockRejectedValue(new Error("User must be an admin"));

      const res = await GET(makeRequest("GET"), { params });
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toBe("Forbidden");
    });

    it("returns null when no invite link exists", async () => {
      mocks.mockAuth.mockResolvedValue({ userId: "user_1" });
      mocks.mockRequireOrgAdmin.mockResolvedValue(undefined);
      mocks.mockGetLeagueForOrg.mockResolvedValue({
        id: "league_1",
        token: null,
      });

      const res = await GET(makeRequest("GET"), { params });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.url).toBeNull();
      expect(body.token).toBeNull();
    });

    it("returns invite link URL when token exists", async () => {
      mocks.mockAuth.mockResolvedValue({ userId: "user_1" });
      mocks.mockRequireOrgAdmin.mockResolvedValue(undefined);
      mocks.mockGetLeagueForOrg.mockResolvedValue({
        id: "league_1",
        token: "abc-123",
      });

      const res = await GET(makeRequest("GET"), { params });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.url).toBe("/join/abc-123");
      expect(body.token).toBe("abc-123");
    });
  });

  describe("POST", () => {
    it("generates a new token and returns 201", async () => {
      mocks.mockAuth.mockResolvedValue({ userId: "user_1" });
      mocks.mockRequireOrgAdmin.mockResolvedValue(undefined);
      mocks.mockGetLeagueForOrg.mockResolvedValue({
        id: "league_1",
        token: null,
      });
      mocks.mockSetLeagueInviteToken.mockResolvedValue(undefined);

      const res = await POST(makeRequest("POST"), { params });
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.url).toBe("/join/test-uuid-1234");
      expect(body.token).toBe("test-uuid-1234");
      expect(mocks.mockSetLeagueInviteToken).toHaveBeenCalledWith("league_1", "test-uuid-1234");
    });
  });

  describe("DELETE", () => {
    it("revokes the token", async () => {
      mocks.mockAuth.mockResolvedValue({ userId: "user_1" });
      mocks.mockRequireOrgAdmin.mockResolvedValue(undefined);
      mocks.mockGetLeagueForOrg.mockResolvedValue({
        id: "league_1",
        token: "abc-123",
      });
      mocks.mockSetLeagueInviteToken.mockResolvedValue(undefined);

      const res = await DELETE(makeRequest("DELETE"), { params });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(mocks.mockSetLeagueInviteToken).toHaveBeenCalledWith("league_1", null);
    });
  });
});

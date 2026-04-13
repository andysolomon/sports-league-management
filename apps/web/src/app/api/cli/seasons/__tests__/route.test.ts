import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));
vi.mock("@/lib/salesforce-api", () => ({ getSeasons: vi.fn() }));
vi.mock("@/lib/org-context", () => ({ resolveOrgContext: vi.fn() }));
vi.mock("@/lib/api-error", () => ({
  handleApiError: vi.fn(() => {
    const { NextResponse } = require("next/server");
    return NextResponse.json({ error: "internal" }, { status: 503 });
  }),
}));

import { auth } from "@clerk/nextjs/server";
import { getSeasons } from "@/lib/salesforce-api";
import { resolveOrgContext } from "@/lib/org-context";
import { GET } from "../route";

const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;
const mockGetSeasons = getSeasons as unknown as ReturnType<typeof vi.fn>;
const mockResolveOrgContext = resolveOrgContext as unknown as ReturnType<typeof vi.fn>;

const fakeOrgContext = {
  userId: "u1",
  orgIds: ["org_1"],
  visibleLeagueIds: ["lg_1"],
};

describe("GET /api/cli/seasons", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null, tokenType: null });
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns all seasons", async () => {
    mockAuth.mockResolvedValue({ userId: "u1", tokenType: "api_key" });
    mockResolveOrgContext.mockResolvedValue(fakeOrgContext);
    mockGetSeasons.mockResolvedValue([
      { id: "s1", name: "2025-26", leagueId: "lg1", startDate: "2025-08-01", endDate: "2026-05-31", status: "Active" },
    ]);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].name).toBe("2025-26");
    expect(mockGetSeasons).toHaveBeenCalledWith(fakeOrgContext.visibleLeagueIds);
  });
});

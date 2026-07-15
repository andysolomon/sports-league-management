import { beforeEach, describe, expect, it, vi } from "vitest";
import { ACTIVE_LEAGUE_COOKIE } from "@/lib/active-league-cookie";

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

vi.mock("@/lib/data-api", () => ({
  getLeague: vi.fn(),
}));

vi.mock("@/lib/org-context", () => ({
  resolveOrgContext: vi.fn(),
}));

import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { getLeague } from "@/lib/data-api";
import { resolveOrgContext } from "@/lib/org-context";
import { setActiveLeaguePreferenceAction } from "../active-league";

const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;
const mockCookies = cookies as unknown as ReturnType<typeof vi.fn>;
const mockGetLeague = getLeague as unknown as ReturnType<typeof vi.fn>;
const mockResolveOrgContext = resolveOrgContext as unknown as ReturnType<
  typeof vi.fn
>;
const mockSet = vi.fn();

describe("setActiveLeaguePreferenceAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ userId: "user-1" });
    mockCookies.mockResolvedValue({ set: mockSet });
    mockResolveOrgContext.mockResolvedValue({
      userId: "user-1",
      orgIds: ["org-1"],
      visibleLeagueIds: ["league-1"],
    });
  });

  it("sets the HttpOnly server-owned cookie for an accessible league", async () => {
    mockGetLeague.mockResolvedValue({
      id: "league-1",
      name: "League 1",
      orgId: "org-1",
    });

    await expect(setActiveLeaguePreferenceAction("league-1")).resolves.toEqual({
      ok: true,
      redirectTo: "/dashboard/leagues/league-1",
    });
    expect(mockSet).toHaveBeenCalledWith(
      ACTIVE_LEAGUE_COOKIE,
      "league-1",
      expect.objectContaining({ httpOnly: true, path: "/" }),
    );
  });

  it("does not mutate the cookie for inaccessible or missing leagues", async () => {
    mockGetLeague.mockResolvedValue(null);

    await expect(setActiveLeaguePreferenceAction("league-2")).resolves.toEqual({
      ok: false,
      redirectTo: null,
    });
    expect(mockSet).not.toHaveBeenCalled();
  });

  it("does not mutate the cookie when unauthenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });

    await expect(setActiveLeaguePreferenceAction("league-1")).resolves.toEqual({
      ok: false,
      redirectTo: null,
    });
    expect(mockSet).not.toHaveBeenCalled();
    expect(mockGetLeague).not.toHaveBeenCalled();
  });
});

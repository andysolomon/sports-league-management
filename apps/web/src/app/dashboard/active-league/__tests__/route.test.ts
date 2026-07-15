import { beforeEach, describe, expect, it, vi } from "vitest";
import { ACTIVE_LEAGUE_COOKIE } from "@/lib/active-league-cookie";

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((to: string) => {
    throw new Error(`NEXT_REDIRECT:${to}`);
  }),
}));

vi.mock("@/lib/data-api", () => ({
  getLeague: vi.fn(),
}));

vi.mock("@/lib/org-context", () => ({
  resolveOrgContext: vi.fn(),
}));

vi.mock("@/lib/active-league", () => ({
  resolveActiveLeague: vi.fn(),
}));

import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { getLeague } from "@/lib/data-api";
import { resolveOrgContext } from "@/lib/org-context";
import { resolveActiveLeague } from "@/lib/active-league";
import { GET } from "../route";

const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;
const mockCookies = cookies as unknown as ReturnType<typeof vi.fn>;
const mockGetLeague = getLeague as unknown as ReturnType<typeof vi.fn>;
const mockResolveOrgContext = resolveOrgContext as unknown as ReturnType<
  typeof vi.fn
>;
const mockResolveActiveLeague = resolveActiveLeague as unknown as ReturnType<
  typeof vi.fn
>;
const mockSet = vi.fn();
const mockDelete = vi.fn();

function request(path: string): Request {
  return new Request(`http://localhost${path}`);
}

describe("active league recovery route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ userId: "user-1" });
    mockCookies.mockResolvedValue({ set: mockSet, delete: mockDelete });
    mockResolveOrgContext.mockResolvedValue({
      userId: "user-1",
      orgIds: ["org-1"],
      visibleLeagueIds: ["league-1"],
    });
  });

  it("sets an accessible target league and redirects to a safe local return path", async () => {
    mockGetLeague.mockResolvedValue({
      id: "league-2",
      name: "League 2",
      orgId: "org-1",
    });

    await expect(
      GET(
        request(
          "/dashboard/active-league?leagueId=league-2&returnTo=/dashboard/teams/team-1",
        ),
      ),
    ).rejects.toThrow("NEXT_REDIRECT:/dashboard/teams/team-1");

    expect(mockSet).toHaveBeenCalledWith(
      ACTIVE_LEAGUE_COOKIE,
      "league-2",
      expect.objectContaining({ httpOnly: true }),
    );
  });

  it("does not mutate inaccessible targets and normalizes external redirects", async () => {
    mockGetLeague.mockResolvedValue(null);

    await expect(
      GET(
        request(
          "/dashboard/active-league?leagueId=league-2&returnTo=https://evil.test/dashboard",
        ),
      ),
    ).rejects.toThrow("NEXT_REDIRECT:/dashboard");

    expect(mockSet).not.toHaveBeenCalled();
  });

  it("recovers stale preferences to the deterministic league home", async () => {
    mockResolveActiveLeague.mockResolvedValue({ activeLeagueId: "league-1" });

    await expect(GET(request("/dashboard/active-league"))).rejects.toThrow(
      "NEXT_REDIRECT:/dashboard/leagues/league-1",
    );
    expect(mockSet).toHaveBeenCalledWith(
      ACTIVE_LEAGUE_COOKIE,
      "league-1",
      expect.objectContaining({ httpOnly: true }),
    );
  });

  it("clears the stale cookie and redirects to onboarding when no leagues exist", async () => {
    mockResolveActiveLeague.mockResolvedValue({ activeLeagueId: null });

    await expect(GET(request("/dashboard/active-league"))).rejects.toThrow(
      "NEXT_REDIRECT:/dashboard/leagues",
    );
    expect(mockDelete).toHaveBeenCalledWith(ACTIVE_LEAGUE_COOKIE);
  });
});

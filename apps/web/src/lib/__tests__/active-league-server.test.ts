import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
  headers: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((to: string) => {
    throw new Error(`NEXT_REDIRECT:${to}`);
  }),
}));

import { cookies, headers } from "next/headers";
import {
  currentDashboardPath,
  syncActiveLeagueForResource,
} from "../active-league-server";

const mockCookies = cookies as unknown as ReturnType<typeof vi.fn>;
const mockHeaders = headers as unknown as ReturnType<typeof vi.fn>;

describe("active league server synchronization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHeaders.mockResolvedValue(
      new Headers({
        "x-dashboard-path": "/dashboard/teams/team-2/roster?view=all",
      }),
    );
  });

  it("keeps an already synchronized resource request in place", async () => {
    mockCookies.mockResolvedValue({
      get: () => ({ value: "league-2" }),
    });

    await expect(
      syncActiveLeagueForResource("league-2"),
    ).resolves.toBeUndefined();
  });

  it("redirects a mismatched resource through the validated mutation boundary", async () => {
    mockCookies.mockResolvedValue({
      get: () => ({ value: "league-1" }),
    });

    await expect(syncActiveLeagueForResource("league-2")).rejects.toThrow(
      "NEXT_REDIRECT:/dashboard/active-league?leagueId=league-2&returnTo=%2Fdashboard%2Fteams%2Fteam-2%2Froster%3Fview%3Dall",
    );
  });

  it("normalizes an untrusted propagated request path", async () => {
    mockHeaders.mockResolvedValue(
      new Headers({ "x-dashboard-path": "https://evil.test/dashboard" }),
    );

    await expect(currentDashboardPath()).resolves.toBe("/dashboard");
  });
});

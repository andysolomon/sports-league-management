import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Sidebar from "../sidebar";
import { activeLeagueSwitchDestination } from "../league-switcher";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => ({ replace: vi.fn() }),
}));

vi.mock("@/app/dashboard/_actions/active-league", () => ({
  setActiveLeaguePreferenceAction: vi.fn(),
}));

describe("active league navigation contracts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a replace destination only for validated switcher mutations", () => {
    expect(
      activeLeagueSwitchDestination({
        ok: true,
        redirectTo: "/dashboard/leagues/league-1",
      }),
    ).toBe("/dashboard/leagues/league-1");
    expect(
      activeLeagueSwitchDestination({ ok: false, redirectTo: null }),
    ).toBeNull();
  });

  it("hides league-scoped sidebar destinations and shows onboarding without a league", () => {
    const html = renderToStaticMarkup(
      createElement(Sidebar, { hasLeagues: false }),
    );

    expect(html).toContain("League Directory");
    expect(html).toContain('href="/dashboard/leagues"');
    expect(html).toContain('href="/dashboard/discover"');
    expect(html).toContain('href="/dashboard/import"');
    expect(html).toContain('href="/dashboard/billing"');
    expect(html).not.toContain('href="/dashboard"');
    expect(html).not.toContain('href="/dashboard/teams"');
    expect(html).not.toContain('href="/dashboard/players"');
    expect(html).not.toContain('href="/dashboard/seasons"');
    expect(html).not.toContain('href="/dashboard/divisions"');
  });
});

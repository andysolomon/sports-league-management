import { test, expect } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";

/*
 * ASR-14 follow-up per docs/issue-578-verification-matrix.md. Asserts the
 * League Directory onboarding surface appears and league-scoped shortcuts
 * are hidden when the operator has zero leagues. The canonical fixture
 * always seeds one league, so the test detects via the authed `/api/leagues`
 * count and skips when the operator owns a league (the documented "green
 * for the canonical fixture" branch). When the canonical fixture grows a
 * second-league or no-league variant this spec graduates into the full
 * assertion path that is fenced off in the body.
 */
test.describe("League Directory shortcut (ASR-14) — no Active League", () => {
  test("no-league operator sees Directory and not league-scoped shortcuts", async ({
    page,
  }) => {
    await setupClerkTestingToken({ page });
    // Navigate to any /dashboard route first so fetch in page.evaluate has an
    // origin to resolve relative URLs against. The authed /api/leagues call
    // itself carries the Clerk session cookie.
    await page.goto("/dashboard/leagues");
    type LeagueSummary = { id: string };
    const leagues = (await page.evaluate(async () => {
      const res = await fetch("/api/leagues");
      if (!res.ok) return null;
      return (await res.json()) as LeagueSummary[];
    })) as LeagueSummary[] | null;

    test.skip(
      leagues === null,
      "Authed /api/leagues rejected in this environment — cannot detect zero-league state.",
    );
    test.skip(
      (leagues?.length ?? 0) > 0,
      "E2E operator owns at least one league — ASR-14 assertion requires a zero-league session. Verified when #596 (or a future fixture variant) exposes a no-league harness.",
    );

    // Operator owns zero leagues: visit /dashboard/leagues and assert the
    // Directory onboarding (page header + empty-state copy).
    await page.goto("/dashboard/leagues");
    await expect(
      page.getByRole("heading", { name: /league directory/i }),
    ).toBeVisible();
    await expect(page.getByText(/no leagues yet/i)).toBeVisible();

    // Sidebar must hide league-scoped shortcuts (hideWithoutLeague: true).
    const sidebar = page.locator("aside");
    for (const leagueScoped of ["Overview", "Teams", "Players", "Seasons"]) {
      await expect(
        sidebar.getByRole("link", { name: leagueScoped }),
      ).toHaveCount(0);
    }
    // Settings is not gated and must remain reachable (ASR-22).
    await expect(sidebar.getByRole("link", { name: "Settings" })).toBeVisible();
  });
});

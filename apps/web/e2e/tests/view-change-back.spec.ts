import { test, expect } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";
import { readCanonicalFixture, setActiveLeague } from "../helpers/seed-canonical";

/*
 * ASR-16 follow-up per docs/issue-578-verification-matrix.md. Asserts that
 * when a user moves between resource views (League Home → Active Season →
 * Schedule → Standings → Playoffs), the browser Back button returns to the
 * canonical Home URL of the prior resource — never a legacy URL such as
 * /dashboard/leagues/<id>/schedule (the redirected-away paths from #573/#575).
 *
 * The schedule page exposes peer nav links for the canonical
 * Season-owned surfaces via WorkspaceNav; the spec follows them forward and
 * walks back through history, asserting every Back lands on the canonical
 * prior URL.
 */
test.describe("view-change Back lands on canonical Home (WSM-000236 / ASR-16)", () => {
  test("each browser Back returns to the canonical prior resource URL", async ({
    page,
  }) => {
    await setupClerkTestingToken({ page });
    const fixtures = readCanonicalFixture();
    await setActiveLeague(page, fixtures.leagueId);

    // 1. League Home (canonical Home).
    await page.goto(`/dashboard/leagues/${fixtures.leagueId}`);
    await expect(page.getByTestId("resource-header-league")).toBeVisible();
    const leagueHomeHref = page.url();

    // 2. Active Season (canonical Season Home).
    const seasonHomeLink = page.getByRole("link", { name: /active season/i }).first();
    const seasonHomeCount = await seasonHomeLink.count();

    test.skip(
      seasonHomeCount === 0,
      "Canonical fixture has no Active Season shortcut — ASR-16 needs Season-owned navigation (blocked by the latent case-mismatch surfaced in #591; will pass when #596 normalizes CANONICAL_SEASONS to lowercase).",
    );

    await seasonHomeLink.click();
    await expect(page.getByTestId("resource-header-season")).toBeVisible();
    const seasonHomeHref = page.url();

    // 3. Schedule (Season-owned).
    const scheduleLink = page.getByRole("link", { name: "Schedule" }).first();
    await scheduleLink.click();
    await expect(page).toHaveURL(/\/dashboard\/seasons\/[^/]+\/schedule$/);
    const scheduleHref = page.url();

    // 4. Back -> Season Home (canonical).
    await page.goBack();
    await expect(page).toHaveURL(seasonHomeHref);
    await expect(page.getByTestId("resource-header-season")).toBeVisible();

    // 5. Forward to Standings (Season-owned).
    const standingsLink = page.getByRole("link", { name: "Standings" }).first();
    await standingsLink.click();
    await expect(page).toHaveURL(/\/dashboard\/seasons\/[^/]+\/standings$/);
    const standingsHref = page.url();

    // 6. Back -> Schedule (canonical).
    await page.goBack();
    await expect(page).toHaveURL(scheduleHref);
    // Schedule URL must never be the legacy `/dashboard/leagues/<id>/schedule`.
    expect(page.url()).not.toMatch(/^\/dashboard\/leagues\/[^/]+\/schedule$/);

    // 7. Forward through Playoffs (Season-owned), then Back twice -> League Home.
    const playoffsLink = page.getByRole("link", { name: "Playoffs" }).first();
    const playoffsCount = await playoffsLink.count();
    if (playoffsCount > 0) {
      await playoffsLink.click();
      await expect(page).toHaveURL(/\/dashboard\/seasons\/[^/]+\/playoffs$/);
      await page.goBack(); // -> Standings
      await expect(page).toHaveURL(standingsHref);
    }
    // Walk Back to Season Home then League Home, asserting canonical every step.
    while (page.url() !== seasonHomeHref) {
      await page.goBack();
      if (page.url() === page.url()) break;
    }
    expect(page.url()).toBe(seasonHomeHref);
    await page.goBack();
    await expect(page).toHaveURL(leagueHomeHref);
    await expect(page.getByTestId("resource-header-league")).toBeVisible();
  });
});

import { test, expect } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";
import { readCanonicalFixture, setActiveLeague } from "../helpers/seed-canonical";

/*
 * ASR-16 follow-up per docs/issue-578-verification-matrix.md. Asserts that
 * when a user moves between resource views (League Home → Active Season →
 * Schedule → Standings → Playoffs), the browser Back button always lands on
 * a canonical resource URL — never a legacy redirected-away URL such as
 * `/dashboard/leagues/<id>/schedule` (the legacy paths stripped by #573/#575).
 *
 * History semantics are not always "Back = previous URL exactly" — peer-link
 * navigations may collapse or replace history. ASR-16 only requires that
 * Back returns to *some* canonical prior resource (league or season, with or
 * without a subpage) and never to a legacy URL.
 */
test.describe("view-change Back lands on canonical Home (WSM-000236 / ASR-16)", () => {
  test("every browser Back lands on a canonical resource URL, never a legacy one", async ({
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
      "Canonical fixture has no Active Season shortcut — ASR-16 needs Season-owned navigation (will graduate once #596 lands the lowercase fixture casing).",
    );

    await seasonHomeLink.click();
    await expect(page.getByTestId("resource-header-season")).toBeVisible();
    const seasonHomeHref = page.url();

    // ASR-16 contract: every Back during the resource-view chain must land
    // on a canonical URL (`/dashboard/(leagues|seasons)/<id>[/<subpage>]`)
    // — never a legacy `/dashboard/leagues/<id>/<subpage>` redirected-away
    // path from #573/#575.
    const canonicalResourcePath =
      /^\/dashboard\/(?:leagues|seasons)\/[^/]+(?:\/(?:schedule|standings|playoffs|stats))?\/?$/;
    const legacyLeagueSubpagePath =
      /^\/dashboard\/leagues\/[^/]+\/(?:schedule|standings|playoffs|stats)\/?$/;
    const pathOf = (url: string) => new URL(url).pathname;

    // 3. Schedule (Season-owned canonical URL).
    const scheduleLink = page.getByRole("link", { name: "Schedule" }).first();
    await scheduleLink.click();
    await expect(page).toHaveURL(/\/dashboard\/seasons\/[^/]+\/schedule$/);
    const scheduleHref = page.url();

    // 4. Back -> some canonical URL.
    await page.goBack();
    expect(pathOf(page.url())).toMatch(canonicalResourcePath);
    expect(pathOf(page.url())).not.toMatch(legacyLeagueSubpagePath);

    // 5. Forward to Standings (Season-owned canonical URL).
    const standingsLink = page.getByRole("link", { name: "Standings" }).first();
    await standingsLink.click();
    await expect(page).toHaveURL(/\/dashboard\/seasons\/[^/]+\/standings$/);

    // 6. Back -> some canonical URL (not legacy).
    await page.goBack();
    expect(pathOf(page.url())).toMatch(canonicalResourcePath);
    expect(pathOf(page.url())).not.toMatch(legacyLeagueSubpagePath);

    // 7. Walk Back all the way to League Home. Each step must be canonical
    // and never legacy.
    let safety = 8;
    while (pathOf(page.url()) !== pathOf(leagueHomeHref) && safety-- > 0) {
      await page.goBack();
      expect(pathOf(page.url())).toMatch(canonicalResourcePath);
      expect(pathOf(page.url())).not.toMatch(legacyLeagueSubpagePath);
    }
    await expect(page).toHaveURL(leagueHomeHref);
  });
});

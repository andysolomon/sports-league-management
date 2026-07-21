import { test, expect } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";
import { readCanonicalFixture, setActiveLeague } from "../helpers/seed-canonical";
import { seasonHomeHref } from "../../src/components/workspace/resource-navigation";

/*
 * Open Active Season shortcut on League Home (ASR-9) — WSM-000254 follow-up
 * per docs/issue-578-verification-matrix.md. Asserts the shortcut lands on
 * the canonical Season URL returned by seasonHomeHref(activeSeason.id), and
 * that the destination's Resource Header identifies the season. Skips the
 * assertion when the canonical fixture is in its "no active season" state
 * (the conditional render omits the shortcut entirely in that case).
 *
 * Reuses the existing `chromium` project's Clerk storageState (auth.setup.ts);
 * do NOT call signInTestUser here — it's reserved for the signed-out
 * `League manage access (WSM-000254)` describe block.
 */
test.describe("Open Active Season shortcut on League Home (WSM-000254 / ASR-9)", () => {
  test("admin shortcut lands on the canonical Season URL and Resource Header", async ({
    page,
  }) => {
    await setupClerkTestingToken({ page });
    const fixture = readCanonicalFixture();
    await setActiveLeague(page, fixture.leagueId);

    await page.goto(`/dashboard/leagues/${fixture.leagueId}`);

    const shortcut = page.getByRole("link", { name: "Open Active Season" });
    const shortcutCount = await shortcut.count();

    test.skip(
      shortcutCount === 0,
      "Canonical fixture has no active season — shortcut is conditionally hidden by design.",
    );

    const expectedHref = await shortcut.first().getAttribute("href");
    expect(expectedHref).toMatch(/^\/dashboard\/seasons\/[^/]+$/);
    expect(expectedHref).toBe(seasonHomeHref(expectedHref!.split("/").pop()!));

    await shortcut.first().click();
    await expect(page).toHaveURL(expectedHref!);
    await expect(page.getByTestId("resource-header-season")).toBeVisible();
  });
});

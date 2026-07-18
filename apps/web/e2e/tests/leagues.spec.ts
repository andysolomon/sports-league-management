import { test, expect } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";
import { readCanonicalFixture, setActiveLeague } from "../helpers/seed-canonical";
import { LEAGUES } from "../helpers/test-data";

test.describe("League Directory", () => {
  test.beforeEach(async ({ page }) => {
    await setupClerkTestingToken({ page });
    await setActiveLeague(page, readCanonicalFixture().leagueId);
    await page.goto("/dashboard/leagues");
  });

  test("page loads with League Directory heading", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "League Directory" }),
    ).toBeVisible();
  });

  test("league rows include an Open action", async ({ page }) => {
    const openButtons = page.getByRole("link", { name: "Open" });
    await expect(openButtons.first()).toBeVisible();
    expect(await openButtons.count()).toBeGreaterThanOrEqual(1);
  });

  test("active league row shows Active badge", async ({ page }) => {
    const activeRow = page.locator("[data-slot='card']", { hasText: LEAGUES.NFL });
    await expect(
      activeRow.getByText("Active League", { exact: true }),
    ).toBeVisible();
  });

  test("Discover card promotes public league browsing", async ({ page }) => {
    await expect(page.getByText("Find public leagues")).toBeVisible();
    await expect(page.getByRole("link", { name: "Discover" })).toBeVisible();
  });
});

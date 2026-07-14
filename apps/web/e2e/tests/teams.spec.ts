import { test, expect } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";
import { readCanonicalFixture, setActiveLeague } from "../helpers/seed-canonical";
import { TEAMS } from "../helpers/test-data";

test.describe("Teams Page", () => {
  test.beforeEach(async ({ page }) => {
    await setupClerkTestingToken({ page });
    const canonical = readCanonicalFixture();
    if (canonical) {
      await setActiveLeague(page, canonical.leagueId);
    }
    await page.goto("/dashboard/teams");
  });

  test("shows Teams heading", async ({ page }) => {
    await expect(
      page.locator("#main-content").getByRole("heading", { name: "Teams" }),
    ).toBeVisible();
  });

  test("renders at least 4 team rows", async ({ page }) => {
    const rows = page.locator("#main-content").getByTestId("team-row");
    await expect(rows.first()).toBeVisible();
    expect(await rows.count()).toBeGreaterThanOrEqual(4);
  });

  test("Cowboys row is present in the table", async ({ page }) => {
    const main = page.locator("#main-content");
    const cowboys = TEAMS.COWBOYS;
    const row = main.getByRole("row", { name: new RegExp(cowboys.name) });
    await expect(row).toBeVisible();
    await expect(row.getByRole("link", { name: cowboys.name })).toBeVisible();
  });

  test("each team name links to the team detail route", async ({ page }) => {
    const links = page.locator(
      "#main-content a[href^='/dashboard/teams/']",
    );
    await expect(links.first()).toBeVisible();
    for (const link of await links.all()) {
      const href = await link.getAttribute("href");
      expect(href).toBeTruthy();
    }
  });
});

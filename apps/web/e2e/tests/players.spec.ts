import { test, expect } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";
import { readCanonicalFixture, setActiveLeague } from "../helpers/seed-canonical";
import { PLAYERS } from "../helpers/test-data";

test.describe("Players Page", () => {
  test.beforeEach(async ({ page }) => {
    await setupClerkTestingToken({ page });
    await setActiveLeague(page, readCanonicalFixture().leagueId);
    await page.goto("/dashboard/players");
  });

  test("shows Players heading", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Players" })).toBeVisible();
  });

  test("table has correct columns", async ({ page }) => {
    const headers = page.locator("thead th");
    await expect(headers.nth(0)).toHaveText("Name");
    await expect(headers.nth(1)).toHaveText("Position");
    await expect(headers.nth(2)).toHaveText("Jersey #");
    await expect(headers.nth(3)).toHaveText("Status");
  });

  test("shows the full active-league roster of 12", async ({ page }) => {
    // The table paginates at 10/page, so assert the footer total rather than
    // counting visible rows (WSM-000187).
    await expect(page.getByText(/Showing 1–10 of 12/)).toBeVisible();
  });

  test("known players show correct data", async ({ page }) => {
    // Search to surface each player — pagination (10/page) means some live on
    // page 2, so filtering by name is how a user finds them (WSM-000187).
    const search = page.getByPlaceholder("Search players...");
    const tbody = page.locator("tbody");

    for (const player of [PLAYERS.PRESCOTT, PLAYERS.MORRIS, PLAYERS.PUIG]) {
      await search.fill(player.name);
      const row = tbody.locator("tr", { hasText: player.name });
      await expect(row).toBeVisible();
      await expect(row).toContainText(player.position);
      await expect(row).toContainText(String(player.jersey));
      await search.clear();
    }
  });
});

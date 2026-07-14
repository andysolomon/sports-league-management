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
    const main = page.locator("#main-content");
    await expect(main.getByRole("heading", { name: "Players" })).toBeVisible();
  });

  test("directory toolbar is present", async ({ page }) => {
    const main = page.locator("#main-content");
    await expect(main.getByRole("button", { name: "Cards" })).toBeVisible();
    await expect(main.getByRole("button", { name: "List" })).toBeVisible();
    await expect(main.getByPlaceholder("Search players or teams…")).toBeVisible();
  });

  test("list view has expected columns when OVR is unavailable", async ({
    page,
  }) => {
    const main = page.locator("#main-content");
    await main.getByRole("button", { name: "List" }).click();
    const headers = main.locator("thead th");
    await expect(headers.nth(0)).toHaveText("Name");
    await expect(headers.nth(1)).toHaveText("Team");
    await expect(headers.nth(2)).toHaveText("Pos");
    await expect(headers.nth(3)).toHaveText("#");
    await expect(headers.nth(4)).toHaveText("Status");
  });

  test("shows roster players for the active league", async ({ page }) => {
    const main = page.locator("#main-content");
    await expect(main.getByText(/Showing 1–/)).toBeVisible();
    await expect(main.getByText(/of \d+/)).toBeVisible();
  });

  test("known players show correct data", async ({ page }) => {
    const main = page.locator("#main-content");
    const search = main.getByPlaceholder("Search players or teams…");

    for (const player of [PLAYERS.PRESCOTT, PLAYERS.MORRIS, PLAYERS.PUIG]) {
      await search.fill(player.name);
      await expect(main.getByText(player.name, { exact: true })).toBeVisible();
      await expect(main.getByText(player.position)).toBeVisible();
      await search.clear();
    }
  });
});

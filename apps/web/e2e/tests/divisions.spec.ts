import { test, expect } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";
import { readCanonicalFixture, setActiveLeague } from "../helpers/seed-canonical";

test.describe("Teams Home Divisions view", () => {
  test.beforeEach(async ({ page }) => {
    await setupClerkTestingToken({ page });
    await setActiveLeague(page, readCanonicalFixture().leagueId);
    await page.goto("/dashboard/teams?view=divisions");
  });

  test("legacy Division Home permanently resolves to the canonical view", async ({
    page,
  }) => {
    await page.goto("/dashboard/divisions");
    await expect(page).toHaveURL("/dashboard/teams?view=divisions");
  });

  test("shows the Divisions alternate view", async ({ page }) => {
    const main = page.locator("#main-content");
    await expect(main.getByRole("heading", { name: "Teams" })).toBeVisible();
    await expect(
      main
        .getByRole("navigation", { name: "Teams Home views" })
        .getByRole("link", { name: "Divisions" }),
    ).toHaveAttribute("aria-current", "page");
  });

  test("renders division panels with standings columns", async ({ page }) => {
    const main = page.locator("#main-content");
    await expect(main.getByText("Record")).toBeVisible();
    await expect(main.getByText("PF")).toBeVisible();
    await expect(main.getByText("Diff")).toBeVisible();
  });

  test("division names are visible", async ({ page }) => {
    const main = page.locator("#main-content");
    await expect(
      main.getByRole("link", { name: /view .* division/i }).first(),
    ).toBeVisible();
  });

  test("selected Division URLs create browser history entries", async ({ page }) => {
    const main = page.locator("#main-content");
    await main.getByRole("link", { name: /view .* division/i }).first().click();
    await expect(page).toHaveURL(/\/dashboard\/teams\?view=divisions&division=/);
    await page.goBack();
    await expect(page).toHaveURL("/dashboard/teams?view=divisions");
  });
});

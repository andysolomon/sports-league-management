import { test, expect } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";
import { readCanonicalFixture, setActiveLeague } from "../helpers/seed-canonical";

test.describe("Divisions Page", () => {
  test.beforeEach(async ({ page }) => {
    await setupClerkTestingToken({ page });
    await setActiveLeague(page, readCanonicalFixture().leagueId);
    await page.goto("/dashboard/divisions");
  });

  test("shows Divisions heading", async ({ page }) => {
    const main = page.locator("#main-content");
    await expect(main.getByRole("heading", { name: "Divisions" })).toBeVisible();
  });

  test("renders division panels with standings columns", async ({ page }) => {
    const main = page.locator("#main-content");
    await expect(main.getByText("Record")).toBeVisible();
    await expect(main.getByText("PF")).toBeVisible();
    await expect(main.getByText("Diff")).toBeVisible();
  });

  test("division names are visible", async ({ page }) => {
    const main = page.locator("#main-content");
    await expect(main.locator("h3").first()).toBeVisible();
  });
});

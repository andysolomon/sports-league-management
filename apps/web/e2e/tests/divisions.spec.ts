import { test, expect } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";
import { LEAGUES } from "../helpers/test-data";

test.describe("Divisions Page", () => {
  test.beforeEach(async ({ page }) => {
    await setupClerkTestingToken({ page });
    await page.goto("/dashboard/divisions");
  });

  test("shows Divisions heading", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Divisions" })).toBeVisible();
  });

  test("table has correct columns", async ({ page }) => {
    const headers = page.locator("thead th");
    await expect(headers.nth(0)).toHaveText("Name");
    await expect(headers.nth(1)).toHaveText("League");
  });

  test("league column shows human-readable names, not Salesforce IDs", async ({ page }) => {
    const rows = page.locator("tbody tr");
    await expect(rows.first()).toBeVisible();
    const count = await rows.count();

    for (let i = 0; i < count; i++) {
      const leagueCell = rows.nth(i).locator("td").nth(1);
      const text = await leagueCell.textContent();
      // Should not look like a Salesforce ID (starts with a0...)
      expect(text?.trim()).not.toMatch(/^a0[A-Za-z0-9]{13,}/);
      // Should be a known league name or a dash
      const validValues = [LEAGUES.NFL, LEAGUES.MLS, "—"];
      expect(validValues).toContain(text?.trim());
    }
  });
});

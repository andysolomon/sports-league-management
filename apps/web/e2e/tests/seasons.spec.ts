import { test, expect } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";
import { SEASONS } from "../helpers/test-data";

test.describe("Seasons Page", () => {
  test.beforeEach(async ({ page }) => {
    await setupClerkTestingToken({ page });
    await page.goto("/dashboard/seasons");
  });

  test("shows Seasons heading", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Seasons" })).toBeVisible();
  });

  test("table has correct columns", async ({ page }) => {
    const headers = page.locator("thead th");
    await expect(headers.nth(0)).toHaveText("Name");
    await expect(headers.nth(1)).toHaveText("Start Date");
    await expect(headers.nth(2)).toHaveText("End Date");
    await expect(headers.nth(3)).toHaveText("Status");
  });

  test("displays at least 3 season rows", async ({ page }) => {
    const rows = page.locator("tbody tr");
    await expect(rows.first()).toBeVisible();
    expect(await rows.count()).toBeGreaterThanOrEqual(3);
  });

  test("2025-2026 NFL Season is present with Active status", async ({ page }) => {
    const row = page.locator("tbody tr", { hasText: SEASONS.NFL_2025.name });
    await expect(row).toBeVisible();
    await expect(row).toContainText(SEASONS.NFL_2025.status);
  });

  test("season statuses are valid values", async ({ page }) => {
    const validStatuses = ["Active", "Completed", "Upcoming"];
    const rows = page.locator("tbody tr");
    const count = await rows.count();

    for (let i = 0; i < count; i++) {
      const statusCell = rows.nth(i).locator("td").nth(3);
      const text = await statusCell.textContent();
      expect(validStatuses).toContain(text?.trim());
    }
  });
});

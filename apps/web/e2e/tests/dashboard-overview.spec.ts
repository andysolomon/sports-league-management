import { test, expect } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";

test.describe("Dashboard Overview", () => {
  test.beforeEach(async ({ page }) => {
    await setupClerkTestingToken({ page });
    await page.goto("/dashboard");
  });

  test("shows Overview heading", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  });

  test("displays 4 stat cards with correct labels", async ({ page }) => {
    const labels = ["Teams", "Players", "Seasons", "Divisions"];
    for (const label of labels) {
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
    }
  });

  test("stat card counts are greater than zero", async ({ page }) => {
    const main = page.locator("main");
    const cards = main.locator("a[href^='/dashboard/']");
    await expect(cards).toHaveCount(4);

    for (const card of await cards.all()) {
      const countText = await card.locator("p.text-3xl").textContent();
      expect(Number(countText)).toBeGreaterThan(0);
    }
  });

  test("Teams count is at least 4", async ({ page }) => {
    const teamsCard = page.locator("a[href='/dashboard/teams']");
    const count = await teamsCard.locator("p.text-3xl").textContent();
    expect(Number(count)).toBeGreaterThanOrEqual(4);
  });

  test("Players count is at least 12", async ({ page }) => {
    const playersCard = page.locator("a[href='/dashboard/players']");
    const count = await playersCard.locator("p.text-3xl").textContent();
    expect(Number(count)).toBeGreaterThanOrEqual(12);
  });

  test("clicking a stat card navigates to the correct page", async ({ page }) => {
    await page.locator("a[href='/dashboard/teams']").click();
    await expect(page).toHaveURL("/dashboard/teams");
    await expect(page.getByRole("heading", { name: "Teams" })).toBeVisible();
  });
});

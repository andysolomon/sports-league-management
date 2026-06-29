import { test, expect } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";
import { TEAMS } from "../helpers/test-data";

test.describe("Teams Page", () => {
  test.beforeEach(async ({ page }) => {
    await setupClerkTestingToken({ page });
    await page.goto("/dashboard/teams");
  });

  test("shows Teams heading", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Teams" })).toBeVisible();
  });

  test("renders at least 4 team cards", async ({ page }) => {
    const cards = page.locator("main a[href^='/dashboard/teams/']");
    await expect(cards.first()).toBeVisible();
    expect(await cards.count()).toBeGreaterThanOrEqual(4);
  });

  test("Cowboys card shows correct details", async ({ page }) => {
    const cowboys = TEAMS.COWBOYS;
    const card = page.locator("a", { hasText: cowboys.name });
    await expect(card).toBeVisible();
    await expect(card).toContainText(cowboys.city);
    await expect(card).toContainText(cowboys.stadium);
    await expect(card).toContainText(String(cowboys.foundedYear));
  });

  test("each team card is a link", async ({ page }) => {
    const cards = page.locator("main a[href^='/dashboard/teams/']");
    await expect(cards.first()).toBeVisible();
    for (const card of await cards.all()) {
      const href = await card.getAttribute("href");
      expect(href).toBeTruthy();
    }
  });
});

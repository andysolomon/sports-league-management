import { test, expect } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";

const NAV_LABELS = ["Overview", "Leagues", "Teams", "Players", "Seasons", "Divisions"];

test.describe("Mobile Responsive Navigation", () => {
  test.beforeEach(async ({ page }) => {
    await setupClerkTestingToken({ page });
  });

  test("hamburger visible on mobile, sidebar hidden", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/dashboard");

    await expect(page.getByLabel("Open navigation menu")).toBeVisible();
    await expect(page.locator("aside")).toBeHidden();
  });

  test("sheet overlay opens with all nav links", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/dashboard");

    await page.getByLabel("Open navigation menu").click();

    for (const label of NAV_LABELS) {
      await expect(page.getByRole("link", { name: label })).toBeVisible();
    }
  });

  test("sheet closes on navigation", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/dashboard");

    await page.getByLabel("Open navigation menu").click();
    await page.getByRole("link", { name: "Players" }).click();

    await expect(page).toHaveURL("/dashboard/players");
    // Sheet should close after navigation
    await expect(page.getByLabel("Open navigation menu")).toBeVisible();
  });

  test("desktop sidebar visible, hamburger hidden", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/dashboard");

    await expect(page.locator("aside")).toBeVisible();
    await expect(page.getByLabel("Open navigation menu")).toBeHidden();
  });

  test("nav icons render on desktop sidebar", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/dashboard");

    const sidebar = page.locator("aside");
    for (const label of NAV_LABELS) {
      const link = sidebar.getByRole("link", { name: label });
      await expect(link.locator("svg")).toBeVisible();
    }
  });
});

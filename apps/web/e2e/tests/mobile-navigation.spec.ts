import { test, expect } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";

/** Shell destinations shared by desktop aside + mobile sheet (ASR-13 / #577). */
const NAV_LABELS = [
  "Overview",
  "Teams",
  "Players",
  "Seasons",
  "Import",
  "Billing",
];
const OBSOLETE_TOP_LEVEL = ["Divisions", "Discover", "Leagues"];

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

    // WSM-000252 / WSM-000246 — mobile sheet mirrors desktop rail chrome
    const sheet = page.getByRole("dialog");
    await expect(
      sheet.getByRole("heading", { name: "Sports League" }),
    ).toBeVisible();

    for (const label of NAV_LABELS) {
      await expect(sheet.getByRole("link", { name: label })).toBeVisible();
    }

    // ASR-4 / ASR-23 — obsolete top-level destinations stay out of the shell
    for (const label of OBSOLETE_TOP_LEVEL) {
      await expect(sheet.getByRole("link", { name: label })).toHaveCount(0);
    }
  });

  test("desktop sidebar shows brand mark and Sports League title", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/dashboard");

    const sidebar = page.locator("aside");
    await expect(
      sidebar.getByRole("heading", { name: "Sports League" }),
    ).toBeVisible();
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

    for (const label of OBSOLETE_TOP_LEVEL) {
      await expect(sidebar.getByRole("link", { name: label })).toHaveCount(0);
    }
  });

  test("desktop sidebar exposes the same shell destinations as mobile", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/dashboard");

    const sidebar = page.locator("aside");
    await expect(
      sidebar.getByRole("heading", { name: "Sports League" }),
    ).toBeVisible();

    for (const label of NAV_LABELS) {
      await expect(sidebar.getByRole("link", { name: label })).toBeVisible();
    }
    for (const label of OBSOLETE_TOP_LEVEL) {
      await expect(sidebar.getByRole("link", { name: label })).toHaveCount(0);
    }
  });
});

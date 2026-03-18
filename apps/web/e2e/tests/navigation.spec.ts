import { test, expect } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";

const NAV_ITEMS = [
  { label: "Overview", href: "/dashboard" },
  { label: "Leagues", href: "/dashboard/leagues" },
  { label: "Teams", href: "/dashboard/teams" },
  { label: "Players", href: "/dashboard/players" },
  { label: "Seasons", href: "/dashboard/seasons" },
  { label: "Divisions", href: "/dashboard/divisions" },
];

test.describe("Dashboard Navigation", () => {
  test.beforeEach(async ({ page }) => {
    await setupClerkTestingToken({ page });
  });

  test("sidebar shows heading and all nav links", async ({ page }) => {
    await page.goto("/dashboard");

    const sidebar = page.locator("aside");
    await expect(sidebar.getByText("Sports League")).toBeVisible();

    for (const item of NAV_ITEMS) {
      await expect(sidebar.getByRole("link", { name: item.label })).toBeVisible();
    }
  });

  test("clicking each nav link navigates to correct URL", async ({ page }) => {
    await page.goto("/dashboard");

    for (const item of NAV_ITEMS) {
      await page.locator("aside").getByRole("link", { name: item.label }).click();
      await expect(page).toHaveURL(item.href);
    }
  });

  test("active nav link has distinct styling", async ({ page }) => {
    await page.goto("/dashboard/teams");

    const teamsLink = page.locator("aside").getByRole("link", { name: "Teams" });
    await expect(teamsLink).toHaveClass(/bg-primary/);

    const overviewLink = page.locator("aside").getByRole("link", { name: "Overview" });
    await expect(overviewLink).not.toHaveClass(/bg-primary/);
  });

  test("header shows Dashboard text", async ({ page }) => {
    await page.goto("/dashboard");

    await expect(page.locator("header").getByText("Dashboard")).toBeVisible();
  });

  test("Clerk UserButton is present", async ({ page }) => {
    await page.goto("/dashboard");

    await expect(page.locator("[data-clerk-component='user-button']")).toBeVisible();
  });

  test("Leagues nav active highlighting", async ({ page }) => {
    await page.goto("/dashboard/leagues");

    const leaguesLink = page.locator("aside").getByRole("link", { name: "Leagues" });
    await expect(leaguesLink).toHaveClass(/bg-primary/);

    const overviewLink = page.locator("aside").getByRole("link", { name: "Overview" });
    await expect(overviewLink).not.toHaveClass(/bg-primary/);
  });

  test("navigation has accessibility role", async ({ page }) => {
    await page.goto("/dashboard");

    await expect(page.locator('nav[role="navigation"]')).toBeVisible();
  });
});

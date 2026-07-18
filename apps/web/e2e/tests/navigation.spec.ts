import { test, expect } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";
import { readCanonicalFixture, setActiveLeague } from "../helpers/seed-canonical";

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

  test("header shows the league switcher", async ({ page }) => {
    await page.goto("/dashboard");

    // The redesigned header (WSM-000136) anchors on the league switcher rather
    // than a literal "Dashboard" label.
    await expect(
      page.locator("header").getByRole("button", { name: /switch league/i }),
    ).toBeVisible();
  });

  test("Clerk user menu is present", async ({ page }) => {
    await page.goto("/dashboard");

    // Clerk v6 renders the UserButton as a trigger button labelled "Open user
    // menu" (the old data-clerk-component attribute is gone).
    await expect(
      page.locator("header").getByRole("button", { name: /open user menu/i }),
    ).toBeVisible();
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

test.describe("League workspace back navigation (WSM-000236)", () => {
  test.beforeEach(async ({ page }) => {
    await setupClerkTestingToken({ page });
    await setActiveLeague(page, readCanonicalFixture().leagueId);
  });

  test("schedule page Resource Header identifies the League Home", async ({
    page,
  }) => {
    const { leagueId } = readCanonicalFixture();
    await page.goto(`/dashboard/leagues/${leagueId}/schedule`);

    const workspace = page.locator("main");
    await expect(workspace.getByRole("searchbox")).toHaveCount(0);
    await expect(workspace.getByText("⌘K")).toHaveCount(0);
    await expect(workspace.getByRole("button", { name: /rename/i })).toHaveCount(
      0,
    );

    // WSM-000571: the Resource Header identifies the League and carries the
    // canonical Schedule label. The breadcrumb/back-row are gone.
    const header = page.getByTestId("resource-header-league");
    await expect(header).toBeVisible();
    await expect(header).toContainText("Schedule");
  });

  test("playoffs page Resource Header identifies the League Home", async ({
    page,
  }) => {
    const { leagueId } = readCanonicalFixture();
    await page.goto(`/dashboard/leagues/${leagueId}/playoffs`);

    const workspace = page.locator("main");
    await expect(workspace.getByRole("searchbox")).toHaveCount(0);
    await expect(workspace.getByText("⌘K")).toHaveCount(0);
    await expect(workspace.getByRole("button", { name: /rename/i })).toHaveCount(
      0,
    );

    const header = page.getByTestId("resource-header-league");
    await expect(header).toBeVisible();
    await expect(header).toContainText("Playoffs");
  });
});

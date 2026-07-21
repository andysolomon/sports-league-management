import { test, expect } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";
import { readCanonicalFixture, setActiveLeague } from "../helpers/seed-canonical";

const NAV_ITEMS: Array<
  { label: string; href: string } | { label: string; hrefPattern: RegExp }
> = [
  { label: "Overview", hrefPattern: /\/dashboard\/leagues\/[^/]+$/ },
  { label: "Teams", href: "/dashboard/teams" },
  { label: "Players", href: "/dashboard/players" },
  { label: "Seasons", href: "/dashboard/seasons" },
];

test.describe("Dashboard Navigation", () => {
  test.beforeEach(async ({ page }) => {
    await setupClerkTestingToken({ page });
  });

  test("sidebar shows heading and all nav links", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForURL(/\/dashboard\/leagues\/[^/]+$/);

    const sidebar = page.locator("aside");
    await expect(sidebar.getByText("Sports League")).toBeVisible();

    for (const item of NAV_ITEMS) {
      await expect(sidebar.getByRole("link", { name: item.label })).toBeVisible();
    }
  });

  test("clicking each nav link navigates to correct URL", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForURL(/\/dashboard\/leagues\/[^/]+$/);

    for (const item of NAV_ITEMS) {
      await page.locator("aside").getByRole("link", { name: item.label }).click();
      if ("hrefPattern" in item) {
        await expect(page).toHaveURL(item.hrefPattern);
      } else {
        await expect(page).toHaveURL(item.href);
      }
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
    await page.waitForURL(/\/dashboard\/leagues\/[^/]+$/);

    // The redesigned header (WSM-000136) anchors on the league switcher rather
    // than a literal "Dashboard" label.
    await expect(
      page.locator("header").getByRole("button", { name: /switch league/i }),
    ).toBeVisible();
  });

  test("Clerk user menu is present", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForURL(/\/dashboard\/leagues\/[^/]+$/);

    // Clerk v6 renders the UserButton as a trigger button labelled "Open user
    // menu" (the old data-clerk-component attribute is gone).
    await expect(
      page.locator("header").getByRole("button", { name: /open user menu/i }),
    ).toBeVisible();
  });

  test("navigation has accessibility role", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForURL(/\/dashboard\/leagues\/[^/]+$/);

    await expect(page.locator('nav[role="navigation"]')).toBeVisible();
  });
});

test.describe("League workspace back navigation (WSM-000236)", () => {
  test.beforeEach(async ({ page }) => {
    await setupClerkTestingToken({ page });
    await setActiveLeague(page, readCanonicalFixture().leagueId);
  });

  test("schedule page Resource Header identifies the Season Home", async ({
    page,
  }) => {
    const { seasonIds } = readCanonicalFixture();
    await page.goto(`/dashboard/seasons/${seasonIds[0]}/schedule`);

    const workspace = page.locator("main");
    await expect(workspace.getByRole("searchbox")).toHaveCount(0);
    await expect(workspace.getByText("⌘K")).toHaveCount(0);
    await expect(workspace.getByRole("button", { name: /rename/i })).toHaveCount(
      0,
    );

    // WSM-000571 / #575: Schedule is Season-owned; the Resource Header
    // identifies the Season and carries the canonical Schedule label.
    const header = page.getByTestId("resource-header-season");
    await expect(header).toBeVisible();
    await expect(header).toContainText("Schedule");
  });

  test("playoffs page Resource Header identifies the Season Home", async ({
    page,
  }) => {
    const { seasonIds } = readCanonicalFixture();
    await page.goto(`/dashboard/seasons/${seasonIds[0]}/playoffs`);

    const workspace = page.locator("main");
    await expect(workspace.getByRole("searchbox")).toHaveCount(0);
    await expect(workspace.getByText("⌘K")).toHaveCount(0);
    await expect(workspace.getByRole("button", { name: /rename/i })).toHaveCount(
      0,
    );

    const header = page.getByTestId("resource-header-season");
    await expect(header).toBeVisible();
    await expect(header).toContainText("Playoffs");
  });

  test("legacy league competition URLs redirect to Season-owned routes", async ({
    page,
  }) => {
    const { leagueId } = readCanonicalFixture();
    await page.goto(`/dashboard/leagues/${leagueId}/schedule`);
    await expect(page).toHaveURL(/\/dashboard\/seasons\/[^/]+\/schedule$/);

    await page.goto(`/dashboard/leagues/${leagueId}/standings`);
    await expect(page).toHaveURL(/\/dashboard\/seasons\/[^/]+\/standings$/);

    await page.goto(`/dashboard/leagues/${leagueId}/playoffs`);
    await expect(page).toHaveURL(/\/dashboard\/seasons\/[^/]+\/playoffs$/);
  });

  // ASR-12 follow-up per docs/issue-578-verification-matrix.md. Asserts the
  // browser Back button after a cross-league Active League switch returns to
  // the prior League A resource URL. Skips cleanly when the e2e user/org owns
  // only one league (canonical fixture currently seeds exactly one).
  test("cross-league switch preserves Back to the prior resource URL", async ({
    page,
  }) => {
    const fixtures = readCanonicalFixture();
    // Drive the league switcher UI to discover whether the e2e org owns
    // more than one league. The dropdown only lists the active + other
    // visible leagues — once #596 reshapes the canonical fixture to add a
    // second league, this count check graduates into the full Back boundary
    // assertion below.
    await setActiveLeague(page, fixtures.leagueId);
    await page.goto(`/dashboard/leagues/${fixtures.leagueId}`);
    const switcher = page.getByRole("button", { name: /switch league/i });
    await switcher.click();
    const options = page.getByRole("menuitemradio");
    const optionCount = await options.count();
    await page.keyboard.press("Escape");

    test.skip(
      optionCount < 2,
      "E2E org owns a single league — cross-league Back contract requires two leagues. Verified when a second canonical league is added.",
    );

    // Two leagues available: graduate to the full boundary assertion.
    // The boundary contract: after a cross-league switch, the browser Back
    // button returns to the prior League A resource URL.
    void fixtures;
    throw new Error(
      "Fence-post: once #596 adds a second canonical league, fill in the " +
        "Boundary assertion here (League A resource URL capture → setActiveLeague(B) → " +
        "navigate to /dashboard → wait for League B URL → page.goBack() → " +
        "expect toHaveURL(leagueAHref) + resource-header-league visible).",
    );
  });
});

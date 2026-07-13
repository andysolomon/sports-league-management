import { test, expect } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";
import { readCanonicalFixture, setActiveLeague } from "../helpers/seed-canonical";
import { LEAGUES, SEASONS } from "../helpers/test-data";

test.describe("Dashboard Overview", () => {
  test.beforeEach(async ({ page }) => {
    await setupClerkTestingToken({ page });
    await setActiveLeague(page, readCanonicalFixture().leagueId);
    await page.goto("/dashboard");
  });

  // The quick-nav "stat strip" is the only grid rendered with lg:grid-cols-5
  // (the bento grid below uses lg:grid-cols-4), so it uniquely scopes the five
  // stat cards and excludes the bento links that also start with /dashboard/.
  const stripSelector = "div.lg\\:grid-cols-5";

  // Stat cards carry the active-league count in <p class="text-stat-30 ...">.
  const countSelector = "p.text-stat-30";

  test("shows Overview heading and subtitle", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
    await expect(page.getByText("Your league at a glance.")).toBeVisible();
  });

  test("displays 5 stat cards with correct labels", async ({ page }) => {
    const strip = page.locator(stripSelector);
    await expect(strip.locator("a")).toHaveCount(5);

    const labels = ["Leagues", "Teams", "Players", "Seasons", "Divisions"];
    for (const label of labels) {
      await expect(strip.getByText(label, { exact: true })).toBeVisible();
    }
  });

  test("stat card counts are greater than zero", async ({ page }) => {
    const cards = page.locator(stripSelector).locator("a");
    await expect(cards).toHaveCount(5);

    for (const card of await cards.all()) {
      const countText = await card.locator(countSelector).textContent();
      expect(Number(countText)).toBeGreaterThan(0);
    }
  });

  test("Teams count is at least 4", async ({ page }) => {
    const teamsCard = page.locator("a[href='/dashboard/teams']");
    const count = await teamsCard.locator(countSelector).textContent();
    expect(Number(count)).toBeGreaterThanOrEqual(4);
  });

  test("Players count is at least 12", async ({ page }) => {
    const playersCard = page.locator("a[href='/dashboard/players']");
    const count = await playersCard.locator(countSelector).textContent();
    expect(Number(count)).toBeGreaterThanOrEqual(12);
  });

  test("clicking a stat card navigates to the correct page", async ({ page }) => {
    // Scope to the stat strip — /dashboard/teams also appears as a bento link.
    await page.locator(stripSelector).locator("a[href='/dashboard/teams']").click();
    await expect(page).toHaveURL("/dashboard/teams");
    await expect(page.getByRole("heading", { name: "Teams" })).toBeVisible();
  });

  test("clicking Leagues stat card navigates to leagues page", async ({ page }) => {
    await page.locator(stripSelector).locator("a[href='/dashboard/leagues']").click();
    await expect(page).toHaveURL("/dashboard/leagues");
    await expect(page.getByRole("heading", { name: "Leagues" })).toBeVisible();
  });

  // The redesign dropped the colored icon-background wrapper (the old
  // ".bg-primary/10" chip). Each stat card now renders its lucide icon as a
  // bare <svg> inside the card body — assert that affordance instead.
  test("stat cards render an icon", async ({ page }) => {
    const firstCard = page.locator(stripSelector).locator("a").first();
    await expect(firstCard.locator("svg")).toBeVisible();
  });

  // The redesign replaced the old "hover:shadow-md" lift with a
  // "hover:border-primary" border highlight on each stat card.
  test("cards have hover affordance class", async ({ page }) => {
    const cards = page.locator(stripSelector).locator("a");
    for (const card of await cards.all()) {
      const innerCard = card.locator("[class*='hover\\:border-primary']");
      await expect(innerCard).toHaveCount(1);
    }
  });
});

test.describe("Dashboard Overview — league at a glance (WSM-000253)", () => {
  test.beforeEach(async ({ page }) => {
    await setupClerkTestingToken({ page });
    const fixture = readCanonicalFixture();
    await setActiveLeague(page, fixture.leagueId);
    await page.goto("/dashboard");
  });

  test("shows league summary and standings cards for the active season", async ({
    page,
  }) => {
    const overview = page.getByTestId("dashboard-overview");
    await expect(overview).toBeVisible();

    const summary = page.getByTestId("league-summary-card");
    await expect(summary.getByText(LEAGUES.NFL, { exact: true })).toBeVisible();
    await expect(summary.getByTestId("overview-active-season")).toHaveText(
      SEASONS.NFL_2025.name,
    );
    await expect(summary.getByTestId("overview-season-progress")).toHaveText(
      /\d+ \/ \d+ played/,
    );
    await expect(summary.getByTestId("overview-team-count")).toHaveText("4");

    const standings = page.getByTestId("standings-card");
    await expect(standings.getByText("Standings", { exact: true })).toBeVisible();
    await expect(page.getByTestId("overview-standings-rows").locator("li")).toHaveCount(4);
    await expect(page.getByTestId("overview-full-standings-link")).toBeVisible();
    await expect(page.getByTestId("overview-full-standings-link")).toHaveText(
      "Full standings →",
    );
  });

  test("Open league navigates to the league hub", async ({ page }) => {
    const fixture = readCanonicalFixture();
    await page.getByRole("link", { name: "Open league" }).click();
    await expect(page).toHaveURL(`/dashboard/leagues/${fixture.leagueId}`);
  });

  test("Seasons button navigates to the seasons list", async ({ page }) => {
    await page
      .getByTestId("league-summary-card")
      .getByRole("link", { name: "Seasons" })
      .click();
    await expect(page).toHaveURL("/dashboard/seasons");
    await expect(page.getByRole("heading", { name: "Seasons" })).toBeVisible();
  });

  // AC #3 (no active season → EmptyState): canonical seed always has an Active
  // season, so behavior is asserted in dashboard-overview unit tests.
  test("active-season overview does not show the no-active-season empty state", async ({
    page,
  }) => {
    await expect(page.getByTestId("dashboard-overview")).toBeVisible();
    await expect(page.getByTestId("overview-no-active-season")).toHaveCount(0);
  });
});

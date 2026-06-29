import { test, expect } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";
import { readCanonicalFixture, setActiveLeague } from "../helpers/seed-canonical";
import { SEASONS } from "../helpers/test-data";

test.describe("Seasons Page", () => {
  test.beforeEach(async ({ page }) => {
    await setupClerkTestingToken({ page });
    await setActiveLeague(page, readCanonicalFixture().leagueId);
    await page.goto("/dashboard/seasons");
  });

  test("shows Seasons heading", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Seasons" })).toBeVisible();
  });

  // The page now groups seasons under per-league Cards (CardHeader = league name
  // + a secondary "<n> season(s)" Badge; CardContent = a <ul class="divide-y">
  // of <li> season rows). There is no longer an HTML table (WSM-000136).
  test("league card shows the league name and a season-count badge", async ({
    page,
  }) => {
    // The canonical fixture seeds every season under one "National Football
    // League" card.
    const nflCard = page.locator('[data-slot="card"]', {
      has: page.getByText("National Football League"),
    });
    await expect(nflCard).toBeVisible();
    // CardHeader: league name (CardTitle) + secondary Badge with the count.
    await expect(nflCard.getByText("National Football League")).toBeVisible();
    await expect(nflCard.getByText(/\d+ seasons?/)).toBeVisible();
  });

  test("displays at least 3 season rows", async ({ page }) => {
    // Season rows are <li> inside the CardContent <ul class="divide-y">.
    const rows = page.locator('[data-slot="card-content"] ul.divide-y > li');
    await expect(rows.first()).toBeVisible();
    expect(await rows.count()).toBeGreaterThanOrEqual(3);
  });

  test("2025-2026 NFL Season is present with Active status", async ({ page }) => {
    const row = page.locator('[data-slot="card-content"] ul.divide-y > li', {
      hasText: SEASONS.NFL_2025.name,
    });
    await expect(row).toBeVisible();
    // StatusBadge renders the canonical label text (not a table cell).
    await expect(
      row.getByText(SEASONS.NFL_2025.status, { exact: true }),
    ).toBeVisible();
  });

  // The seasons page is org-wide (all visible leagues), so other leagues' data
  // would make a "every row is valid" assertion non-deterministic. Assert the
  // canonical seasons specifically (WSM-000187). The canonical fixture puts all
  // three under the single "National Football League" card.
  test("canonical seasons render their expected status badge", async ({ page }) => {
    const validStatuses = ["Active", "Completed", "Upcoming"];
    const canonical = [SEASONS.NFL_2025, SEASONS.NFL_2024, SEASONS.MLS_2025];
    const nflCard = page.locator('[data-slot="card"]', {
      has: page.getByText("National Football League"),
    });

    for (const season of canonical) {
      expect(validStatuses).toContain(season.status);
      const row = nflCard.locator("li", { hasText: season.name });
      await expect(row).toBeVisible();
      // Season name <span>.
      await expect(row.getByText(season.name, { exact: true })).toBeVisible();
      // StatusBadge label via resolveStatusBadge — assert the visible label.
      await expect(
        row.getByText(season.status, { exact: true }),
      ).toBeVisible();
    }
  });
});

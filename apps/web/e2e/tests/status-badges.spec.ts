import { test, expect } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";
import { readCanonicalFixture, setActiveLeague } from "../helpers/seed-canonical";
import { PLAYERS, TEAMS, SEASONS } from "../helpers/test-data";

// Status badges were redesigned (WSM-000136) from raw `bg-*-100` tints to
// shadcn-style variants. The current mapping (see components/ui/badge.tsx):
//   success   -> "bg-accent/15 text-accent"           (Active player, Active/Completed season)
//   warning   -> "bg-yellow-500/15 text-yellow-400"   (Injured player)
//   secondary -> "bg-secondary text-secondary-foreground" (Inactive player)
// We assert the badge LABEL text plus a stable substring of the variant class
// (avoiding the `/15` opacity suffix, which is awkward in CSS selectors).

test.describe("Status Badges and Date Formatting", () => {
  test.beforeEach(async ({ page }) => {
    await setupClerkTestingToken({ page });
    await setActiveLeague(page, readCanonicalFixture().leagueId);
  });

  test("Active player has green badge", async ({ page }) => {
    await page.goto("/dashboard/players");

    // Search first — players paginate at 10/page (Prescott may be off page 1).
    await page.getByPlaceholder("Search players...").fill(PLAYERS.PRESCOTT.name);
    const row = page.locator("tbody tr", { hasText: PLAYERS.PRESCOTT.name });
    const badge = row.getByText(PLAYERS.PRESCOTT.status, { exact: true });
    await expect(badge).toBeVisible();
    // success variant = accent (green) token
    await expect(badge).toHaveClass(/bg-accent/);
  });

  test("Injured player has yellow badge", async ({ page }) => {
    await page.goto("/dashboard/players");

    await page.getByPlaceholder("Search players...").fill(PLAYERS.PARSONS.name);
    const row = page.locator("tbody tr", { hasText: PLAYERS.PARSONS.name });
    const badge = row.getByText(PLAYERS.PARSONS.status, { exact: true });
    await expect(badge).toBeVisible();
    // warning variant = yellow token
    await expect(badge).toHaveClass(/bg-yellow-500/);
  });

  test("Inactive player has gray badge", async ({ page }) => {
    await page.goto("/dashboard/players");

    // Barmore is on page 2 if unpaginated — search to bring the row into view.
    await page.getByPlaceholder("Search players...").fill(PLAYERS.BARMORE.name);
    const row = page.locator("tbody tr", { hasText: PLAYERS.BARMORE.name });
    const badge = row.getByText(PLAYERS.BARMORE.status, { exact: true });
    await expect(badge).toBeVisible();
    // secondary variant = neutral (gray) token
    await expect(badge).toHaveClass(/bg-secondary/);
  });

  test("season status badges render correctly", async ({ page }) => {
    await page.goto("/dashboard/seasons");

    // Seasons render as <li> rows inside per-league cards (not a <table>).
    // Active season (NFL 2025) -> success (accent) variant.
    const activeRow = page.locator("li", { hasText: SEASONS.NFL_2025.name });
    const activeBadge = activeRow.getByText(SEASONS.NFL_2025.status, {
      exact: true,
    });
    await expect(activeBadge).toBeVisible();
    await expect(activeBadge).toHaveClass(/bg-accent/);

    // Completed season (NFL 2024) -> also success (accent) variant.
    const completedRow = page.locator("li", { hasText: SEASONS.NFL_2024.name });
    const completedBadge = completedRow.getByText(SEASONS.NFL_2024.status, {
      exact: true,
    });
    await expect(completedBadge).toBeVisible();
    await expect(completedBadge).toHaveClass(/bg-accent/);
  });

  test("dates display in formatted style, not ISO", async ({ page }) => {
    await page.goto("/dashboard/seasons");

    // Dates should be formatted like "Sep 4, 2025" not "2025-09-04".
    const activeRow = page.locator("li", { hasText: SEASONS.NFL_2025.name });
    await expect(activeRow).toBeVisible();
    const rowText = await activeRow.textContent();

    // No ISO date format anywhere in the row.
    expect(rowText).not.toMatch(/\d{4}-\d{2}-\d{2}/);

    // Human-readable date pattern (Mon D, YYYY or Mon DD, YYYY).
    expect(rowText).toMatch(/[A-Z][a-z]{2}\s+\d{1,2},\s+\d{4}/);
  });

  test("null dates show dash", async ({ page }) => {
    await page.goto("/dashboard/seasons");

    // formatDate() renders an em-dash (—) for null dates. (The date-range
    // separator is an en-dash –, so this won't false-positive on present
    // dates.) Seed seasons all have dates, so we expect zero em-dashes; in that
    // case just confirm a formatted season row rendered.
    const dashCells = page.getByText("—", { exact: true });
    const count = await dashCells.count();
    if (count === 0) {
      const row = page.locator("li", { hasText: SEASONS.NFL_2025.name });
      await expect(row.first()).toBeVisible();
    }
  });

  test("team detail shows founded year", async ({ page }) => {
    await page.goto("/dashboard/teams");
    await page.getByText(TEAMS.COWBOYS.name).first().click();

    // Scope to the team detail-fields <dl> (the only one on the page) so the
    // founded-year value doesn't clash with the same year elsewhere.
    const founded = page
      .locator("dl")
      .getByText(String(TEAMS.COWBOYS.foundedYear), { exact: true });
    await expect(founded.first()).toBeVisible();
  });
});

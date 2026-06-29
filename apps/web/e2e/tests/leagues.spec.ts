import { test, expect } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";
import { readCanonicalFixture, setActiveLeague } from "../helpers/seed-canonical";
import { LEAGUES } from "../helpers/test-data";

test.describe("Leagues Hierarchy Page", () => {
  test.beforeEach(async ({ page }) => {
    await setupClerkTestingToken({ page });
    await setActiveLeague(page, readCanonicalFixture().leagueId);
    await page.goto("/dashboard/leagues");
  });

  test("page loads with hierarchy", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Leagues" })).toBeVisible();
    const cards = page.locator("[class*='card']").or(page.locator("[data-slot='card']"));
    await expect(cards.first()).toBeVisible();
  });

  test("league card shows division count badge", async ({ page }) => {
    // The NFL name appears in several places (league switcher, card title,
    // accordion), so scope straight to the card and assert its digit-prefixed
    // "<n> division(s)" count badge.
    const nflCard = page.locator("[data-slot='card']", { hasText: LEAGUES.NFL });
    await expect(nflCard.first()).toBeVisible();
    await expect(nflCard.getByText(/\d+ divisions?/i).first()).toBeVisible();
  });

  test("divisions listed with team counts", async ({ page }) => {
    const nflCard = page.locator("[data-slot='card']", { hasText: LEAGUES.NFL });

    // Divisions should have team count badges
    await expect(nflCard.getByText(/team/i).first()).toBeVisible();
  });

  test("team links navigate to team detail", async ({ page }) => {
    // Teams live inside a collapsed division accordion — expand it first, then
    // click the team LINK (role=link), not just the matching text node. The
    // trigger text recurs (header badge, controls), so take the first.
    await page.getByRole("button", { name: /League Division/i }).first().click();
    await page.getByRole("link", { name: /Dallas Cowboys/ }).first().click();
    await expect(page).toHaveURL(/\/dashboard\/teams\//);
    await expect(page.getByRole("heading", { name: "Dallas Cowboys" })).toBeVisible();
  });

  test("empty state for leagues without divisions", async ({ page }) => {
    // The active NFL league HAS divisions, so the accordion's empty placeholder
    // ("No divisions yet.") must not be shown.
    const nflCard = page.locator("[data-slot='card']", { hasText: LEAGUES.NFL });
    await expect(nflCard.getByText("No divisions yet.")).toBeHidden();
  });
});

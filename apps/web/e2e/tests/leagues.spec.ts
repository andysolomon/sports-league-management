import { test, expect } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";
import { LEAGUES } from "../helpers/test-data";

test.describe("Leagues Hierarchy Page", () => {
  test.beforeEach(async ({ page }) => {
    await setupClerkTestingToken({ page });
    await page.goto("/dashboard/leagues");
  });

  test("page loads with hierarchy", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Leagues" })).toBeVisible();
    const cards = page.locator("[class*='card']").or(page.locator("[data-slot='card']"));
    await expect(cards.first()).toBeVisible();
  });

  test("league card shows division count badge", async ({ page }) => {
    const nflText = page.getByText(LEAGUES.NFL);
    await expect(nflText).toBeVisible();

    // Find the card containing NFL and check for a division badge
    const nflCard = page.locator("[data-slot='card']", { hasText: LEAGUES.NFL });
    await expect(nflCard.getByText(/division/i)).toBeVisible();
  });

  test("divisions listed with team counts", async ({ page }) => {
    const nflCard = page.locator("[data-slot='card']", { hasText: LEAGUES.NFL });

    // Divisions should have team count badges
    await expect(nflCard.getByText(/team/i).first()).toBeVisible();
  });

  test("team links navigate to team detail", async ({ page }) => {
    // Click a team link (e.g., Dallas Cowboys)
    await page.getByText("Dallas Cowboys").click();
    await expect(page).toHaveURL(/\/dashboard\/teams\//);
    await expect(page.getByRole("heading", { name: "Dallas Cowboys" })).toBeVisible();
  });

  test("empty state for leagues without divisions", async ({ page }) => {
    // Verify that leagues with divisions do NOT show the empty text
    const nflCard = page.locator("[data-slot='card']", { hasText: LEAGUES.NFL });
    await expect(nflCard.getByText("No divisions in this league.")).toBeHidden();
  });
});

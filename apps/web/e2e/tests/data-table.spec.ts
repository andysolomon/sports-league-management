import { test, expect } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";
import { readCanonicalFixture, setActiveLeague } from "../helpers/seed-canonical";
import { PLAYERS } from "../helpers/test-data";

// The players page replaced the generic DataTable with the directory list
// view (WSM-000249); these tests cover the same interactions — search,
// empty state, sorting, pagination summary — against the new surface.
test.describe("Players directory list interactions", () => {
  test.beforeEach(async ({ page }) => {
    await setupClerkTestingToken({ page });
    await setActiveLeague(page, readCanonicalFixture().leagueId);
    await page.goto("/dashboard/players");
    const main = page.locator("#main-content");
    await expect(main.getByRole("heading", { name: "Players" })).toBeVisible();
    await main.getByRole("button", { name: "List" }).click();
    await expect(main.locator("thead th").first()).toBeVisible();
  });

  test("search filters table rows", async ({ page }) => {
    const main = page.locator("#main-content");
    await main.getByPlaceholder("Search players or teams…").fill("Prescott");
    const rows = main.locator("tbody tr");
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText(PLAYERS.PRESCOTT.name);
  });

  test("search is case-insensitive", async ({ page }) => {
    const main = page.locator("#main-content");
    await main.getByPlaceholder("Search players or teams…").fill("PRESCOTT");
    const rows = main.locator("tbody tr");
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText(PLAYERS.PRESCOTT.name);
  });

  test("search with no results shows empty state", async ({ page }) => {
    const main = page.locator("#main-content");
    await main
      .getByPlaceholder("Search players or teams…")
      .fill("ZZZZNONEXISTENT");
    await expect(main.getByText("No players found")).toBeVisible();
    await expect(
      main.getByText("Try a different search or filter."),
    ).toBeVisible();
  });

  test("column sorting toggles order", async ({ page }) => {
    const main = page.locator("#main-content");
    const nameHeader = main.locator("thead th", { hasText: "Name" });
    await nameHeader.click();
    const firstAsc = await main
      .locator("tbody tr")
      .first()
      .locator("td")
      .first()
      .textContent();

    await nameHeader.click();
    const firstDesc = await main
      .locator("tbody tr")
      .first()
      .locator("td")
      .first()
      .textContent();

    expect(firstAsc).not.toBe(firstDesc);
  });

  test("pagination summary reflects the roster size", async ({ page }) => {
    // Canonical league fits on one page (page size 25 in list view), so the
    // summary shows the full range and the pagers are disabled.
    const main = page.locator("#main-content");
    await expect(main.getByText(/Showing 1–\d+ of \d+/)).toBeVisible();
    await expect(main.getByText(/Page 1 of 1/)).toBeVisible();
    await expect(
      main.getByRole("button", { name: "Previous page" }),
    ).toBeDisabled();
    await expect(main.getByRole("button", { name: "Next page" })).toBeDisabled();
  });
});

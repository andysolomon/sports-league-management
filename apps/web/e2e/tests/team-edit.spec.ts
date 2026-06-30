import { test, expect } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";
import { readCanonicalFixture, setActiveLeague } from "../helpers/seed-canonical";
import { TEAMS } from "../helpers/test-data";

test.describe("Team Edit", () => {
  test.beforeEach(async ({ page }) => {
    await setupClerkTestingToken({ page });
    await setActiveLeague(page, readCanonicalFixture().leagueId);
    // Navigate to Cowboys team detail page
    await page.goto("/dashboard/teams");
    await page.locator("a", { hasText: TEAMS.COWBOYS.name }).click();
    await expect(page.getByRole("heading", { name: TEAMS.COWBOYS.name })).toBeVisible();
  });

  test("Edit Team button is visible", async ({ page }) => {
    await expect(page.getByRole("button", { name: "Edit Team" })).toBeVisible();
  });

  test("dialog opens pre-populated with team data", async ({ page }) => {
    await page.getByRole("button", { name: "Edit Team" }).click();

    await expect(page.getByRole("heading", { name: "Edit Team" })).toBeVisible();
    // #team-name is still a text <input>; #team-city is now a Radix Select
    // trigger (a combobox button) whose selected value renders as its text, so
    // assert on the rendered city rather than an input value.
    await expect(page.locator("#team-name")).toHaveValue(TEAMS.COWBOYS.name);
    await expect(page.locator("#team-city")).toContainText(TEAMS.COWBOYS.city);
  });

  // QUARANTINED (#434): #team-city is a Radix Select; this test still
  // .clear()/.fill()s it. Rewrite to drive the Select via option clicks.
  test.fixme("saves changes and restores", async ({ page }) => {
    await page.getByRole("button", { name: "Edit Team" }).click();

    await page.locator("#team-city").clear();
    await page.locator("#team-city").fill("Dallas-FW");
    await page.getByRole("button", { name: "Save Changes" }).click();

    await expect(page.locator("[data-sonner-toast]")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Dallas-FW")).toBeVisible();

    // Restore original value
    await page.getByRole("button", { name: "Edit Team" }).click();
    await page.locator("#team-city").clear();
    await page.locator("#team-city").fill(TEAMS.COWBOYS.city);
    await page.getByRole("button", { name: "Save Changes" }).click();

    await expect(page.locator("[data-sonner-toast]")).toBeVisible({ timeout: 10000 });
  });

  test("form validation prevents empty name", async ({ page }) => {
    await page.getByRole("button", { name: "Edit Team" }).click();

    await page.locator("#team-name").clear();
    await page.getByRole("button", { name: "Save Changes" }).click();

    // Dialog should stay open
    await expect(page.getByRole("heading", { name: "Edit Team" })).toBeVisible();
  });

  test("error handling shows toast on failure", async ({ page }) => {
    await page.route("**/api/teams/**", (route) => {
      if (route.request().method() === "PUT" || route.request().method() === "PATCH") {
        return route.fulfill({ status: 500, body: JSON.stringify({ error: "Server error" }) });
      }
      return route.continue();
    });

    await page.getByRole("button", { name: "Edit Team" }).click();
    await page.getByRole("button", { name: "Save Changes" }).click();

    await expect(page.locator("[data-sonner-toast]")).toBeVisible({ timeout: 10000 });
    // Dialog should remain open for retry
    await expect(page.getByRole("heading", { name: "Edit Team" })).toBeVisible();
  });
});

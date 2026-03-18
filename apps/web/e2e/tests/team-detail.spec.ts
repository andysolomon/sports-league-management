import { test, expect } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";
import { TEAMS, PLAYERS } from "../helpers/test-data";

test.describe("Team Detail Page", () => {
  test.beforeEach(async ({ page }) => {
    await setupClerkTestingToken({ page });
    // Navigate to Cowboys detail via the teams list
    await page.goto("/dashboard/teams");
    await page.locator("a", { hasText: TEAMS.COWBOYS.name }).click();
  });

  test("shows team name as heading", async ({ page }) => {
    await expect(page.getByRole("heading", { name: TEAMS.COWBOYS.name })).toBeVisible();
  });

  test("shows team detail fields", async ({ page }) => {
    await expect(page.getByText("City")).toBeVisible();
    await expect(page.getByText(TEAMS.COWBOYS.city)).toBeVisible();
    await expect(page.getByText("Stadium")).toBeVisible();
    await expect(page.getByText(TEAMS.COWBOYS.stadium)).toBeVisible();
    await expect(page.getByText("Founded")).toBeVisible();
    await expect(page.getByText(String(TEAMS.COWBOYS.foundedYear))).toBeVisible();
  });

  test("shows Player Roster section with count", async ({ page }) => {
    const rosterHeading = page.getByText(/Player Roster \(\d+\)/);
    await expect(rosterHeading).toBeVisible();
  });

  test("roster table has correct columns", async ({ page }) => {
    const headers = page.locator("thead th");
    await expect(headers.nth(0)).toHaveText("Name");
    await expect(headers.nth(1)).toHaveText("Position");
    await expect(headers.nth(2)).toHaveText("Jersey #");
    await expect(headers.nth(3)).toHaveText("Status");
  });

  test("known Cowboys players are present with correct data", async ({ page }) => {
    const tbody = page.locator("tbody");

    // Dak Prescott
    const prescottRow = tbody.locator("tr", { hasText: PLAYERS.PRESCOTT.name });
    await expect(prescottRow).toBeVisible();
    await expect(prescottRow).toContainText(PLAYERS.PRESCOTT.position);
    await expect(prescottRow).toContainText(String(PLAYERS.PRESCOTT.jersey));

    // CeeDee Lamb
    const lambRow = tbody.locator("tr", { hasText: PLAYERS.LAMB.name });
    await expect(lambRow).toBeVisible();
    await expect(lambRow).toContainText(PLAYERS.LAMB.position);
    await expect(lambRow).toContainText(String(PLAYERS.LAMB.jersey));

    // Micah Parsons
    const parsonsRow = tbody.locator("tr", { hasText: PLAYERS.PARSONS.name });
    await expect(parsonsRow).toBeVisible();
    await expect(parsonsRow).toContainText(PLAYERS.PARSONS.position);
    await expect(parsonsRow).toContainText(String(PLAYERS.PARSONS.jersey));
    await expect(parsonsRow).toContainText(PLAYERS.PARSONS.status);
  });

  test("Back to Teams link navigates back", async ({ page }) => {
    await page.getByRole("link", { name: /Back to Teams/ }).click();
    await expect(page).toHaveURL("/dashboard/teams");
  });
});

import { test, expect } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";
import { PLAYERS } from "../helpers/test-data";

test.describe("Players Page", () => {
  test.beforeEach(async ({ page }) => {
    await setupClerkTestingToken({ page });
    await page.goto("/dashboard/players");
  });

  test("shows Players heading", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Players" })).toBeVisible();
  });

  test("table has correct columns", async ({ page }) => {
    const headers = page.locator("thead th");
    await expect(headers.nth(0)).toHaveText("Name");
    await expect(headers.nth(1)).toHaveText("Position");
    await expect(headers.nth(2)).toHaveText("Jersey #");
    await expect(headers.nth(3)).toHaveText("Status");
  });

  test("displays at least 12 player rows", async ({ page }) => {
    const rows = page.locator("tbody tr");
    await expect(rows.first()).toBeVisible();
    expect(await rows.count()).toBeGreaterThanOrEqual(12);
  });

  test("known players show correct data", async ({ page }) => {
    const tbody = page.locator("tbody");

    // Dak Prescott
    const prescottRow = tbody.locator("tr", { hasText: PLAYERS.PRESCOTT.name });
    await expect(prescottRow).toBeVisible();
    await expect(prescottRow).toContainText(PLAYERS.PRESCOTT.position);
    await expect(prescottRow).toContainText(String(PLAYERS.PRESCOTT.jersey));

    // Jordan Morris
    const morrisRow = tbody.locator("tr", { hasText: PLAYERS.MORRIS.name });
    await expect(morrisRow).toBeVisible();
    await expect(morrisRow).toContainText(PLAYERS.MORRIS.position);
    await expect(morrisRow).toContainText(String(PLAYERS.MORRIS.jersey));

    // Riqui Puig
    const puigRow = tbody.locator("tr", { hasText: PLAYERS.PUIG.name });
    await expect(puigRow).toBeVisible();
    await expect(puigRow).toContainText(PLAYERS.PUIG.position);
  });
});

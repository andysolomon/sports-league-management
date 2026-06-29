import { test, expect } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";
import { TEAMS, PLAYERS } from "../helpers/test-data";

test.describe.serial("Player CRUD", () => {
  test.beforeEach(async ({ page }) => {
    await setupClerkTestingToken({ page });
    // Navigate to Cowboys team detail page
    await page.goto("/dashboard/teams");
    await page.getByText(TEAMS.COWBOYS.name).click();
    await expect(page.getByRole("heading", { name: TEAMS.COWBOYS.name })).toBeVisible();
  });

  test("Add Player dialog opens with form fields", async ({ page }) => {
    await page.getByRole("button", { name: "Add Player" }).click();

    await expect(page.getByRole("heading", { name: "Add Player" })).toBeVisible();
    await expect(page.locator("#player-name")).toBeVisible();
    await expect(page.locator("#player-position")).toBeVisible();
    await expect(page.locator("#player-jersey")).toBeVisible();
    await expect(page.locator("#player-status")).toBeVisible();
  });

  test("create player with valid data", async ({ page }) => {
    await page.getByRole("button", { name: "Add Player" }).click();

    await page.locator("#player-name").fill("E2E Test Player");
    await page.locator("#player-position").fill("TE");
    await page.locator("#player-jersey").fill("99");
    // Status defaults to Active

    await page.getByRole("button", { name: "Add Player" }).last().click();

    // Wait for success toast
    await expect(page.locator("[data-sonner-toast]")).toBeVisible({ timeout: 10000 });

    // Verify player appears in roster
    await expect(page.getByText("E2E Test Player")).toBeVisible();
  });

  test("form validation prevents empty name", async ({ page }) => {
    await page.getByRole("button", { name: "Add Player" }).click();

    // Clear name and try to submit
    await page.locator("#player-name").clear();
    await page.locator("#player-position").fill("TE");
    await page.getByRole("button", { name: "Add Player" }).last().click();

    // Dialog should stay open (validation error)
    await expect(page.getByRole("heading", { name: "Add Player" })).toBeVisible();
  });

  test("edit opens pre-populated dialog", async ({ page }) => {
    // Find E2E Test Player row and click edit
    const row = page.locator("tbody tr", { hasText: "E2E Test Player" });
    await row.locator("button").first().click(); // Pencil icon button

    await expect(page.getByRole("heading", { name: "Edit Player" })).toBeVisible();
    await expect(page.locator("#player-name")).toHaveValue("E2E Test Player");
  });

  test("edit saves changes", async ({ page }) => {
    const row = page.locator("tbody tr", { hasText: "E2E Test Player" });
    await row.locator("button").first().click();

    await page.locator("#player-position").clear();
    await page.locator("#player-position").fill("WR");
    await page.getByRole("button", { name: "Save Changes" }).click();

    await expect(page.locator("[data-sonner-toast]")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("tbody tr", { hasText: "E2E Test Player" })).toContainText("WR");
  });

  test("delete with confirmation removes player", async ({ page }) => {
    const row = page.locator("tbody tr", { hasText: "E2E Test Player" });
    // Click delete button (the red-colored trash button)
    await row.locator("button.text-red-600").click();

    await expect(page.getByRole("heading", { name: "Delete Player" })).toBeVisible();
    await page.getByRole("button", { name: "Delete" }).click();

    await expect(page.locator("[data-sonner-toast]")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("E2E Test Player")).toBeHidden();
  });

  test("delete cancel keeps player in roster", async ({ page }) => {
    // Find Prescott's row and click delete
    const row = page.locator("tbody tr", { hasText: PLAYERS.PRESCOTT.name });
    await row.locator("button.text-red-600").click();

    await expect(page.getByRole("heading", { name: "Delete Player" })).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();

    // Prescott should still be visible
    await expect(page.getByText(PLAYERS.PRESCOTT.name)).toBeVisible();
  });

  test("error toast on failed mutation", async ({ page }) => {
    // Intercept player creation API with 500 error
    await page.route("**/api/players**", (route) => {
      if (route.request().method() === "POST") {
        return route.fulfill({ status: 500, body: JSON.stringify({ error: "Server error" }) });
      }
      return route.continue();
    });

    await page.getByRole("button", { name: "Add Player" }).click();
    await page.locator("#player-name").fill("Error Test Player");
    await page.locator("#player-position").fill("QB");
    await page.getByRole("button", { name: "Add Player" }).last().click();

    // Error toast should appear
    await expect(page.locator("[data-sonner-toast]")).toBeVisible({ timeout: 10000 });
  });
});

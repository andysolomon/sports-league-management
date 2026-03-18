import { test, expect } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";
import { PLAYERS } from "../helpers/test-data";

test.describe("DataTable Interactions", () => {
  test.beforeEach(async ({ page }) => {
    await setupClerkTestingToken({ page });
    await page.goto("/dashboard/players");
    await expect(page.getByRole("heading", { name: "Players" })).toBeVisible();
  });

  test("search filters table rows", async ({ page }) => {
    await page.getByPlaceholder("Search...").fill("Prescott");
    const rows = page.locator("tbody tr");
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText(PLAYERS.PRESCOTT.name);
  });

  test("search is case-insensitive", async ({ page }) => {
    await page.getByPlaceholder("Search...").fill("PRESCOTT");
    const rows = page.locator("tbody tr");
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText(PLAYERS.PRESCOTT.name);
  });

  test("search with no results shows empty state", async ({ page }) => {
    await page.getByPlaceholder("Search...").fill("ZZZZNONEXISTENT");
    await expect(page.getByText("No results found.")).toBeVisible();
    await expect(page.locator("tbody tr")).toHaveCount(1); // empty state row
  });

  test("column sorting toggles order", async ({ page }) => {
    const nameButton = page.locator("thead button", { hasText: "Name" });
    await nameButton.click();
    const firstNameAsc = await page.locator("tbody tr").first().locator("td").first().textContent();

    await nameButton.click();
    const firstNameDesc = await page.locator("tbody tr").first().locator("td").first().textContent();

    expect(firstNameAsc).not.toBe(firstNameDesc);
  });

  test("pagination controls visible for 12+ rows", async ({ page }) => {
    await expect(page.getByText(/Showing 1–10 of 12/)).toBeVisible();
    await expect(page.getByText("Page 1 of 2")).toBeVisible();
  });

  test("pagination navigation works", async ({ page }) => {
    // The pagination section has Previous and Next buttons with chevron icons
    const paginationArea = page.locator("div.flex.items-center.justify-between");
    const buttons = paginationArea.locator("button");
    const prevButton = buttons.first();
    const nextButton = buttons.last();

    await nextButton.click();
    await expect(page.getByText("Page 2 of 2")).toBeVisible();
    await expect(page.getByText(/Showing 11–12 of 12/)).toBeVisible();

    await prevButton.click();
    await expect(page.getByText("Page 1 of 2")).toBeVisible();
    await expect(page.getByText(/Showing 1–10 of 12/)).toBeVisible();
  });
});

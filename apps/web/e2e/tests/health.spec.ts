import { test, expect } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";

test.describe("Health & Smoke Tests", () => {
  test.beforeEach(async ({ page }) => {
    await setupClerkTestingToken({ page });
  });

  test("dashboard loads without Salesforce error", async ({ page }) => {
    await page.goto("/dashboard");

    // The error boundary shows "Something went wrong" with "Salesforce API error"
    // when the SF connection is broken — assert it does NOT appear
    await expect(page.getByText("Something went wrong")).toBeHidden({
      timeout: 15_000,
    });
    await expect(
      page.getByRole("heading", { name: "Overview" })
    ).toBeVisible();
  });

  test("API returns data, not 500", async ({ page }) => {
    // Hit a read-only API endpoint through the browser (with Clerk auth)
    const response = await page.request.get("/api/leagues");
    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
  });

  test("no error toasts on initial page load", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(
      page.getByRole("heading", { name: "Overview" })
    ).toBeVisible();

    // Wait briefly then check no error toasts appeared
    await page.waitForTimeout(2000);
    await expect(page.locator("[data-sonner-toast][data-type='error']")).toHaveCount(0);
  });
});

import { test, expect } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";
import { signInTestUser } from "../helpers/clerk-signin";

test.describe("Health & Smoke Tests", () => {
  // Every assertion here hits an auth-gated surface (/dashboard, /api/leagues),
  // so the testing token (bot-bypass only) is not enough — we must establish a
  // signed-in session, exactly like the auth-gated specs do. Without this the
  // dashboard bounces to the Clerk sign-in page and, because the `chromium`
  // project depends on `health`, the whole suite is skipped (WSM-000172).
  test.beforeEach(async ({ page }) => {
    await setupClerkTestingToken({ page });
    await signInTestUser(page);
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

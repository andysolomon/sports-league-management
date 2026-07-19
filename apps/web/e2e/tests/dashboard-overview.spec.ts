import { test, expect } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";
import { readCanonicalFixture, setActiveLeague } from "../helpers/seed-canonical";

test.describe("/dashboard entry redirect", () => {
  test.beforeEach(async ({ page }) => {
    await setupClerkTestingToken({ page });
    await setActiveLeague(page, readCanonicalFixture().leagueId);
  });

  test("navigating to /dashboard lands on League Home", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForURL(/\/dashboard\/leagues\/[^/]+$/);

    const header = page.getByTestId("resource-header-league");
    await expect(header).toBeVisible();
    await expect(header.getByText("League Home")).toBeVisible();
  });
});

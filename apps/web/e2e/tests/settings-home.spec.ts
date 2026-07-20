import { test, expect } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";
import {
  readCanonicalFixture,
  setActiveLeague,
} from "../helpers/seed-canonical";

/*
 * Settings homes (issue #576, ASR-8/ASR-11): Settings Home branches to League
 * Settings (Org Admin of the Active League) and Account Settings, which owns
 * Import and Billing. Legacy /dashboard/import and /dashboard/billing URLs
 * permanently redirect under Account Settings.
 */
test.describe("Settings homes (issue #576)", () => {
  test.beforeEach(async ({ page }) => {
    await setupClerkTestingToken({ page });
    await setActiveLeague(page, readCanonicalFixture().leagueId);
  });

  test("Settings Home branches to League and Account Settings", async ({
    page,
  }) => {
    await page.goto("/dashboard/settings");

    await expect(page.getByTestId("settings-home")).toBeVisible();
    // The canonical test user is Org Admin of the canonical league, so the
    // League Settings branch is visible (ASR-11).
    await expect(page.getByTestId("settings-league-link")).toBeVisible();
    await expect(page.getByTestId("settings-account-link")).toBeVisible();

    await page.getByTestId("settings-account-link").click();
    await expect(page).toHaveURL("/dashboard/settings/account");
    await expect(page.getByTestId("account-import-link")).toBeVisible();
    await expect(page.getByTestId("account-billing-link")).toBeVisible();
  });

  test("League Settings renders the manage surface for the Active League", async ({
    page,
  }) => {
    await page.goto("/dashboard/settings/league");
    await expect(page.getByTestId("league-manage-settings")).toBeVisible();
  });

  test("legacy import and billing URLs redirect under Account Settings", async ({
    page,
  }) => {
    await page.goto("/dashboard/import");
    await expect(page).toHaveURL("/dashboard/settings/account/import");

    // Billing redirect must preserve Stripe Checkout return params.
    await page.goto("/dashboard/billing?cancelled=true");
    await expect(page).toHaveURL(
      "/dashboard/settings/account/billing?cancelled=true",
    );
  });
});

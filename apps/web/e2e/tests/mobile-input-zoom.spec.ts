import { test, expect, devices } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";
import {
  withRosterFixture,
  getTestOrgId,
  type RosterFixtureResult,
} from "../helpers/seed-roster";

/*
 * WSM-000085: iOS Safari auto-zooms the page when you focus a form control
 * whose font-size is below 16px. A `@media (pointer: coarse)` rule in
 * globals.css bumps inputs/selects/textareas to 16px on touch devices to stop
 * that. Emulating a real iPhone gives us a coarse primary pointer, so the rule
 * applies — assert our controls render at >= 16px.
 */
test.use({ ...devices["iPhone 13"] });

test.describe.serial("Mobile — no input auto-zoom on focus (WSM-000085)", () => {
  let fixture: RosterFixtureResult | null = null;
  let teardown: (() => Promise<void>) | null = null;

  test.beforeAll(async () => {
    const orgId = getTestOrgId();
    test.skip(!orgId, "E2E_CLERK_ORG_ID not set");
    const handle = await withRosterFixture({
      fixtureKey: "mobile-input-zoom",
      clerkOrgId: orgId,
      teamName: "E2E Mobile Zoom Team",
      rosterLimit: 53,
      seedActivePlayers: 3,
      extraBenchPlayers: 0,
      positionSlot: "QB",
    });
    fixture = handle.fixture;
    teardown = handle.teardown;
  });

  test.afterAll(async () => {
    if (teardown) await teardown();
  });

  test.beforeEach(async ({ page }) => {
    await setupClerkTestingToken({ page });
  });

  test("roster search input renders at >= 16px (no iOS zoom)", async ({
    page,
  }) => {
    await page.goto(`/dashboard/teams/${fixture!.teamId}`);
    await page.waitForLoadState("networkidle");

    const search = page.getByPlaceholder("Search players...");
    await expect(search).toBeVisible();

    const fontSizePx = await search.evaluate(
      (el) => parseFloat(getComputedStyle(el).fontSize),
    );
    expect(
      fontSizePx,
      `focused inputs below 16px trigger iOS auto-zoom (got ${fontSizePx}px)`,
    ).toBeGreaterThanOrEqual(16);
  });
});

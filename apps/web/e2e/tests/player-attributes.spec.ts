import { test, expect } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";
import {
  withRosterFixture,
  getTestOrgId,
  type RosterFixtureResult,
} from "../helpers/seed-roster";
import { signInTestUser } from "../helpers/clerk-signin";

/*
 * Player attributes (Phase 2 / WSM-000064) e2e smoke.
 *
 * Covers the happy path the user would actually walk:
 *   1. Admin opens a player's /dashboard/.../development page.
 *   2. Pastes canonical-source JSON into AttributesUploadDialog.
 *   3. Page revalidates → chart shows the new point + table row.
 *   4. League starts private — public viewer route 404s.
 *   5. Admin flips Make-public on the league detail page.
 *   6. Public route now renders the same chart (no auth needed).
 *
 * Runtime prerequisites mirror the WSM-000022+ harness setup:
 *   - CONVEX_ENABLE_E2E_SEED=1 on the target Convex deployment
 *   - E2E_CLERK_USER_ID + E2E_CLERK_ORG_ID in the Playwright env
 *   - The Clerk test user must be org:admin of E2E_CLERK_ORG_ID
 *     (matches the existing roster e2e prerequisites — no new setup)
 */
test.describe.serial(
  "Player attributes — ingest + chart (WSM-000064)",
  () => {
    let fixture: RosterFixtureResult | null = null;
    let teardown: (() => Promise<void>) | null = null;

    test.beforeAll(async () => {
      const orgId = getTestOrgId();
      test.skip(!orgId, "E2E_CLERK_ORG_ID not set");
      const handle = await withRosterFixture({
        fixtureKey: "player-attributes-smoke",
        clerkOrgId: orgId,
        teamName: "E2E Attrs Test Team",
        rosterLimit: 53,
        seedActivePlayers: 1,
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
      await signInTestUser(page);
    });

    test("admin uploads canonical JSON; chart + table render the row", async ({
      page,
    }) => {
      if (!fixture) test.skip();
      const playerId = fixture!.playerIds[0];

      await page.goto(`/dashboard/players/${playerId}/development`);
      await expect(
        page.getByRole("heading", { name: /E2E Player 1/ }),
      ).toBeVisible();

      // Open the upload modal (admin-only — should be visible because
      // the test user is org:admin per the seed-roster fixture's clerkOrgId).
      await page.getByRole("button", { name: "Add attributes" }).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();

      // Source is "Admin (canonical JSON)" by default. Pick the season.
      await dialog.getByLabel("Season").click();
      await page.getByRole("option", { name: /E2E Season/ }).click();

      // Paste the canonical JSON.
      const textarea = dialog.getByLabel("Raw JSON");
      await textarea.fill(
        '{"positionGroup":"QB","attributes":{"armStrength":92,"accuracy":88,"overall":90}}',
      );

      await dialog.getByRole("button", { name: "Ingest" }).click();
      await expect(dialog).toBeHidden();

      // Page revalidated — table now has the row.
      await expect(
        page.getByRole("cell", { name: /E2E Season/ }).first(),
      ).toBeVisible();
      // Overall column shows 90.0 (formatted to 1 decimal).
      await expect(
        page.locator("td").filter({ hasText: /^90\.0$/ }).first(),
      ).toBeVisible();
    });

    test("league public toggle gates the public viewer route", async ({
      page,
    }) => {
      if (!fixture) test.skip();
      const leagueId = fixture!.leagueId;
      const playerId = fixture!.playerIds[0];

      // Public viewer with a private league → 404.
      const privateResp = await page.goto(
        `/leagues/${leagueId}/players/${playerId}/development`,
      );
      expect(privateResp?.status()).toBe(404);

      // Flip the league to public via the admin toggle on the detail page.
      await page.goto(`/dashboard/leagues/${leagueId}`);
      await page
        .getByRole("button", { name: /Make public/ })
        .click();
      await expect(
        page.getByRole("button", { name: /Make private/ }),
      ).toBeVisible();

      // Public route now renders the chart (chart was populated in the
      // previous test, so the row should be visible here too).
      await page.goto(
        `/leagues/${leagueId}/players/${playerId}/development`,
      );
      await expect(
        page.getByRole("heading", { name: "Player Development" }),
      ).toBeVisible();
      await expect(
        page.getByRole("cell", { name: /E2E Season/ }).first(),
      ).toBeVisible();
    });
  },
);

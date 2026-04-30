import { test, expect } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";
import {
  withScheduleFixture,
  type ScheduleFixtureResult,
} from "../helpers/seed-schedule";
import { getTestOrgId } from "../helpers/seed-roster";
import { signInTestUser } from "../helpers/clerk-signin";

/*
 * Schedules & standings (Phase 3 / WSM-000074) e2e smoke.
 *
 * Walks the admin's schedule loop end-to-end:
 *   1. Admin opens /dashboard/leagues/[id]/schedule.
 *   2. Creates a fixture between two seeded teams via FixtureFormDialog.
 *   3. Opens RecordResultDialog, enters a final score.
 *   4. Standings page shows the winner with W=1 + matching PF.
 *   5. League starts private — public /leagues/[id]/standings 404s.
 *   6. Admin flips Make-public on the league detail page.
 *   7. Public standings route renders with the same row.
 *
 * Same runtime prerequisites as the player-attributes spec
 * (WSM-000064): CONVEX_ENABLE_E2E_SEED=1 on target Convex,
 * E2E_CLERK_USER_ID + E2E_CLERK_ORG_ID in the Playwright env.
 */
test.describe.serial(
  "Schedules & standings — fixture loop (WSM-000074)",
  () => {
    let fixture: ScheduleFixtureResult | null = null;
    let teardown: (() => Promise<void>) | null = null;

    test.beforeAll(async () => {
      const orgId = getTestOrgId();
      test.skip(!orgId, "E2E_CLERK_ORG_ID not set");
      const handle = await withScheduleFixture({
        fixtureKey: "schedules-standings-smoke",
        clerkOrgId: orgId,
        homeTeamName: "E2E Home Hawks",
        awayTeamName: "E2E Away Owls",
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

    test("admin creates a fixture, records the result, standings update", async ({
      page,
    }) => {
      if (!fixture) test.skip();
      const leagueId = fixture!.leagueId;

      // 1. Open the schedule page.
      await page.goto(`/dashboard/leagues/${leagueId}/schedule`);
      await expect(
        page.getByRole("heading", { name: /Schedule/ }),
      ).toBeVisible();

      // 2. Create a fixture.
      await page.getByRole("button", { name: "New fixture" }).click();
      const fixtureDialog = page.getByRole("dialog");
      await expect(fixtureDialog).toBeVisible();

      await fixtureDialog.getByLabel("Home team").click();
      await page.getByRole("option", { name: "E2E Home Hawks" }).click();
      await fixtureDialog.getByLabel("Away team").click();
      await page.getByRole("option", { name: "E2E Away Owls" }).click();
      await fixtureDialog.getByLabel("Week").fill("1");

      await fixtureDialog
        .getByRole("button", { name: "Create fixture" })
        .click();
      await expect(fixtureDialog).toBeHidden();

      // The new row appears in Week 1.
      await expect(page.getByText("Week 1")).toBeVisible();
      await expect(
        page.getByRole("cell", { name: "E2E Home Hawks" }),
      ).toBeVisible();

      // 3. Record the result.
      await page.getByRole("button", { name: "Record result" }).click();
      const resultDialog = page.getByRole("dialog");
      await expect(resultDialog).toBeVisible();

      await resultDialog.getByLabel(/E2E Home Hawks/).fill("21");
      await resultDialog.getByLabel(/E2E Away Owls/).fill("10");
      await resultDialog.getByRole("button", { name: "Save result" }).click();
      await expect(resultDialog).toBeHidden();

      // The schedule row now shows 21 – 10 + status final.
      await expect(page.getByText("21 – 10")).toBeVisible();
      await expect(page.getByText("final").first()).toBeVisible();

      // 4. Standings page reflects the result.
      await page.goto(`/dashboard/leagues/${leagueId}/standings`);
      await expect(
        page.getByRole("heading", { name: /Season standings/ }),
      ).toBeVisible();
      // Hawks row: 1 W, 21 PF, 10 PA, +11 differential, league rank 1.
      const hawksRow = page.locator("tr").filter({ hasText: "E2E Home Hawks" });
      await expect(hawksRow).toBeVisible();
      await expect(hawksRow).toContainText("1"); // wins column
      await expect(hawksRow).toContainText("+11");
    });

    test("league public toggle gates the public standings viewer", async ({
      page,
    }) => {
      if (!fixture) test.skip();
      const leagueId = fixture!.leagueId;

      // Public viewer with a private league → 404.
      const privateResp = await page.goto(`/leagues/${leagueId}/standings`);
      expect(privateResp?.status()).toBe(404);

      // Flip public via the admin toggle on the league detail page.
      await page.goto(`/dashboard/leagues/${leagueId}`);
      await page.getByRole("button", { name: /Make public/ }).click();
      await expect(
        page.getByRole("button", { name: /Make private/ }),
      ).toBeVisible();

      // Public route now renders the same standings table.
      await page.goto(`/leagues/${leagueId}/standings`);
      await expect(
        page.getByRole("heading", { name: "Standings" }),
      ).toBeVisible();
      await expect(
        page.getByRole("cell", { name: "E2E Home Hawks" }),
      ).toBeVisible();
    });
  },
);

import { test, expect } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";
import path from "node:path";
import {
  withScheduleFixture,
  type ScheduleFixtureResult,
} from "../helpers/seed-schedule";
import { getTestOrgId } from "../helpers/seed-roster";
import {
  acceptBrowserConfirms,
  bootstrapFourTeamSimLeague,
  confirmLifecycleDialog,
  simChampionship,
  simPlayoffsScope,
  simRegularSeason,
} from "../helpers/sim-league-setup";

/*
 * Playoffs bracket (WSM-000164/165) — advance gate, bracket render, champion.
 *
 * WSM-000239: playoffs are now STARTED from the schedule page's handoff panel
 * ("Start playoffs"), which appears only when the decided active season's
 * regular slate is fully final and no bracket exists. The playoffs page keeps
 * its own (disabled/enabled) "Advance to playoffs" gate, asserted alongside.
 *
 * Read-only waiting state ("Regular season complete — waiting for playoffs to
 * start"): NOT driven end-to-end. The e2e environment has no viewer-role
 * Clerk user — user A is org A's admin, user B is org B's admin and 404s on
 * org A leagues (see coach-roster cross-org spec) — so that branch is covered
 * by unit tests on resolvePlayoffHandoff (src/lib/playoff-handoff.ts) instead.
 */
const FIXTURE_KEY = "playoffs-bracket";
const LEAGUE_NAME = `E2E:${FIXTURE_KEY}`;
const STORAGE_STATE = path.resolve("e2e", ".auth", "user.json");

test.describe("Playoffs bracket (WSM-000164)", () => {
  let fixture: ScheduleFixtureResult | null = null;
  let teardown: (() => Promise<void>) | null = null;

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(300_000);
    const orgId = getTestOrgId();
    test.skip(!orgId, "E2E_CLERK_ORG_ID not set");
    const handle = await withScheduleFixture({
      fixtureKey: FIXTURE_KEY,
      clerkOrgId: orgId,
      homeTeamName: "E2E PO Home",
      awayTeamName: "E2E PO Away",
    });
    fixture = handle.fixture;
    teardown = handle.teardown;

    const context = await browser.newContext({ storageState: STORAGE_STATE });
    const page = await context.newPage();
    await setupClerkTestingToken({ page });
    acceptBrowserConfirms(page);
    await bootstrapFourTeamSimLeague(page, fixture.leagueId, LEAGUE_NAME, {
      playoffTeams: 4,
    });
    await context.close();
  });

  test.afterAll(async () => {
    if (teardown) await teardown();
  });

  test.beforeEach(async ({ page }) => {
    test.setTimeout(240_000);
    await setupClerkTestingToken({ page });
    acceptBrowserConfirms(page);
  });

  test("advance gate, bracket generation, semifinal sim, and explicit championship", async ({
    page,
  }) => {
    if (!fixture) test.skip();
    const seasonId = fixture!.seasonId;

    await page.goto(`/dashboard/seasons/${seasonId}/playoffs`);
    await expect(
      page
        .locator("#main-content")
        .getByTestId("resource-header-season")
        .getByText(`Playoffs · ${LEAGUE_NAME}`),
    ).toBeVisible();
    await expect(page.getByText(/Regular season in progress/)).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Advance to playoffs" }),
    ).toBeDisabled();

    // WSM-000239: while games remain, the schedule page offers NO handoff.
    await page.goto(`/dashboard/seasons/${seasonId}/schedule`);
    await expect(page.locator("#main-content").getByTestId("playoff-handoff")).toHaveCount(0);
    await simRegularSeason(page);

    // Playoffs page flips to ready (its advance button enables)…
    await page.goto(`/dashboard/seasons/${seasonId}/playoffs`);
    await expect(page.getByText(/Regular season complete/)).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Advance to playoffs" }),
    ).toBeEnabled();

    // …and the schedule page now shows the admin handoff panel. Start the
    // playoffs from HERE (WSM-000239).
    await page.goto(`/dashboard/seasons/${seasonId}/schedule`);
    const handoff = page.locator("#main-content").getByTestId("playoff-handoff");
    await expect(handoff).toBeVisible();
    await expect(handoff.getByText(/Regular season complete/)).toBeVisible();
    const startPlayoffs = handoff.getByRole("button", {
      name: "Start playoffs",
    });
    await expect(startPlayoffs).toBeEnabled();
    await startPlayoffs.click();
    await confirmLifecycleDialog(page);
    await expect(
      page.getByText(/Playoffs started — \d+ matchups/),
    ).toBeVisible({ timeout: 60_000 });

    // Once the bracket exists the handoff disappears from the schedule page.
    await page.reload();
    await expect(page.locator("#main-content").getByTestId("playoff-handoff")).toHaveCount(0);

    await page.goto(`/dashboard/seasons/${seasonId}/playoffs`);
    await expect(page.getByText("Champion", { exact: true })).toHaveCount(0);
    await expect(page.getByTestId(/^playoff-drawer-trigger-/).first()).toBeVisible();
    await expect(page.getByText(/E2E PO|E2E Team/).first()).toBeVisible();
    await expect(
      page.getByText(/Round 1|Semifinal|Quarterfinal/i).first(),
    ).toBeVisible();

    const bracketTrigger = page.getByTestId(/^playoff-drawer-trigger-/).first();
    await bracketTrigger.click();
    const drawer = page.getByTestId("game-context-drawer");
    await expect(drawer).toBeVisible();
    await expect(drawer.getByTestId("game-drawer-mode")).toHaveText(/^Preview/);
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();

    await page.goto(`/dashboard/seasons/${seasonId}/schedule`);
    await simPlayoffsScope(page);
    await expect(
      page.getByText(/through the semifinals|Simulated \d+ playoff game/),
    ).toBeVisible({
      timeout: 120_000,
    });

    await page.goto(`/dashboard/seasons/${seasonId}/playoffs`);
    await expect(page.getByText("Champion", { exact: true })).toHaveCount(0);
    await simChampionship(page);
    await expect(page.getByText(/wins the championship!/)).toBeVisible({
      timeout: 120_000,
    });
    await expect(page.getByText("Champion", { exact: true })).toBeVisible();
    await expect(
      page.locator(".rounded-lg.border-primary\\/30").getByRole("link").first(),
    ).toBeVisible();

    const finalBracketTrigger = page
      .getByTestId(/^playoff-drawer-trigger-/)
      .filter({ has: page.locator(".font-semibold") })
      .first();
    await finalBracketTrigger.click();
    await expect(page.getByTestId("game-context-drawer")).toBeVisible();
    await expect(
      page.getByTestId("game-context-drawer").getByTestId("game-drawer-mode"),
    ).toHaveText(/^Final/);
  });
});

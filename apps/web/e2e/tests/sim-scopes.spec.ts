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
  openSimulateScopeMenu,
  simPlayoffsScope,
  simWeek,
  weekCard,
} from "../helpers/sim-league-setup";

/*
 * Simulation scopes (WSM-000183) — week-scoped and season-scoped batch sims.
 * One league per file; one end-to-end test so Playwright retries stay consistent.
 */
const FIXTURE_KEY = "sim-scopes";
const LEAGUE_NAME = `E2E:${FIXTURE_KEY}`;
const STORAGE_STATE = path.resolve("e2e", ".auth", "user.json");

test.describe("Simulation scopes (WSM-000183)", () => {
  let fixture: ScheduleFixtureResult | null = null;
  let teardown: (() => Promise<void>) | null = null;

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(300_000);
    const orgId = getTestOrgId();
    test.skip(!orgId, "E2E_CLERK_ORG_ID not set");
    const handle = await withScheduleFixture({
      fixtureKey: FIXTURE_KEY,
      clerkOrgId: orgId,
      homeTeamName: "E2E Home Hawks",
      awayTeamName: "E2E Away Owls",
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
    test.setTimeout(180_000);
    await setupClerkTestingToken({ page });
    acceptBrowserConfirms(page);
  });

  test("Sim week, scope menu, and playoffs-without-bracket handling", async ({
    page,
  }) => {
    if (!fixture) test.skip();
    const leagueId = fixture!.leagueId;

    await page.goto(`/dashboard/leagues/${leagueId}/schedule`);
    await expect(
      page.getByRole("heading", { name: LEAGUE_NAME }),
    ).toBeVisible();

    const week1 = weekCard(page, 1);
    const week2 = weekCard(page, 2);
    await expect(week1).toBeVisible();
    await expect(week2).toBeVisible();

    const week1ScheduledBefore = await week1
      .getByText("Scheduled", { exact: true })
      .count();
    expect(week1ScheduledBefore).toBeGreaterThan(0);

    await simWeek(page, 1);
    await expect(week1.getByText("Scheduled", { exact: true })).toHaveCount(0, {
      timeout: 60_000,
    });
    await expect(week1.getByText("Final", { exact: true }).first()).toBeVisible();

    const week2ScheduledAfter = await week2
      .getByText("Scheduled", { exact: true })
      .count();
    expect(week2ScheduledAfter).toBeGreaterThan(0);

    await openSimulateScopeMenu(page);
    await expect(
      page.getByRole("menuitem", { name: "Sim regular season" }),
    ).toBeVisible();
    await expect(
      page.getByRole("menuitem", { name: "Sim playoffs" }),
    ).toBeVisible();
    await expect(
      page.getByRole("menuitem", { name: "Sim to champion" }),
    ).toBeVisible();
    await page.keyboard.press("Escape");

    // Without a bracket the action fails: the error surfaces as a toast and
    // the confirm dialog stays open for retry.
    await simPlayoffsScope(page, { expectClose: false });
    await expect(
      page.getByText(
        "No playoff bracket yet. Generate a bracket on the Playoffs page first.",
      ),
    ).toBeVisible({ timeout: 30_000 });
    await page.getByTestId("action-confirm-cancel").click();
    await expect(page.getByTestId("action-confirm-dialog")).toBeHidden();
  });
});

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
  advanceToPlayoffs,
  bootstrapFourTeamSimLeague,
  simPlayoffsScope,
  simRegularSeason,
} from "../helpers/sim-league-setup";

/*
 * Playoffs bracket (WSM-000164/165) — advance gate, bracket render, champion.
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

  test("advance gate, bracket generation, and champion after sim playoffs", async ({
    page,
  }) => {
    if (!fixture) test.skip();
    const leagueId = fixture!.leagueId;

    await page.goto(`/dashboard/leagues/${leagueId}/playoffs`);
    await expect(
      page.getByRole("heading", { name: LEAGUE_NAME }),
    ).toBeVisible();
    await expect(page.getByText(/Regular season in progress/)).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Advance to playoffs" }),
    ).toBeDisabled();

    await page.goto(`/dashboard/leagues/${leagueId}/schedule`);
    await simRegularSeason(page);

    await page.goto(`/dashboard/leagues/${leagueId}/playoffs`);
    await expect(page.getByText(/Regular season complete/)).toBeVisible();
    const advance = page.getByRole("button", { name: "Advance to playoffs" });
    await expect(advance).toBeEnabled();
    await advanceToPlayoffs(page);
    await expect(
      page.getByText(/Playoffs started — \d+ matchups/),
    ).toBeVisible({ timeout: 60_000 });

    await expect(page.getByText("Champion", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("link").filter({ hasText: /E2E PO|E2E Team/ }).first()).toBeVisible();
    await expect(
      page.getByText(/Round 1|Semifinal|Quarterfinal/i).first(),
    ).toBeVisible();

    await page.goto(`/dashboard/leagues/${leagueId}/schedule`);
    await simPlayoffsScope(page);
    await expect(page.getByText(/wins — simulated|Simulated \d+ playoff game/)).toBeVisible({
      timeout: 120_000,
    });

    await page.goto(`/dashboard/leagues/${leagueId}/playoffs`);
    await expect(page.getByText("Champion", { exact: true })).toBeVisible();
    await expect(
      page.locator(".rounded-lg.border-primary\\/30").getByRole("link").first(),
    ).toBeVisible();
  });
});

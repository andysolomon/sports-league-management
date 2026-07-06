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
  simToChampion,
} from "../helpers/sim-league-setup";

/*
 * Dynasty panel (D1) — class distribution, rollover gate, offseason advance.
 */
const FIXTURE_KEY = "dynasty";
const LEAGUE_NAME = `E2E:${FIXTURE_KEY}`;
const STORAGE_STATE = path.resolve("e2e", ".auth", "user.json");

test.describe("Dynasty panel (dynasty rollover)", () => {
  let fixture: ScheduleFixtureResult | null = null;
  let teardown: (() => Promise<void>) | null = null;

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(300_000);
    const orgId = getTestOrgId();
    test.skip(!orgId, "E2E_CLERK_ORG_ID not set");
    const handle = await withScheduleFixture({
      fixtureKey: FIXTURE_KEY,
      clerkOrgId: orgId,
      homeTeamName: "E2E Dyn Home",
      awayTeamName: "E2E Dyn Away",
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
    test.setTimeout(300_000);
    await setupClerkTestingToken({ page });
    acceptBrowserConfirms(page);
  });

  test("class distribution, gated rollover, and post-champion advance", async ({
    page,
  }) => {
    if (!fixture) test.skip();
    const leagueId = fixture!.leagueId;

    await page.goto(`/dashboard/leagues/${leagueId}`);
    await expect(page.getByText("Dynasty", { exact: true })).toBeVisible();
    await expect(page.getByText("Class distribution")).toBeVisible();

    const classGrid = page.locator("dl").filter({ hasText: "FR" });
    await expect(classGrid.getByText("FR", { exact: true })).toBeVisible();
    await expect(classGrid.getByText("SO", { exact: true })).toBeVisible();
    await expect(classGrid.getByText("JR", { exact: true })).toBeVisible();
    await expect(classGrid.getByText("SR", { exact: true })).toBeVisible();

    for (const label of ["FR", "SO", "JR", "SR"] as const) {
      const countText = await classGrid
        .locator("dt", { hasText: label })
        .locator("xpath=following-sibling::dd[1]")
        .innerText();
      expect(Number(countText)).toBeGreaterThan(0);
    }

    const startBtn = page.getByRole("button", { name: "Start next season" });
    await expect(startBtn).toBeDisabled();
    await expect(page.getByText(/\d+ games? unplayed\./)).toBeVisible();

    let jrPlayerId: string | null = null;
    await page.goto(`/dashboard/teams/${fixture!.homeTeamId}`);
    const rosterRows = page.locator("tbody tr");
    const rowCount = await rosterRows.count();
    for (let i = 0; i < Math.min(rowCount, 8); i++) {
      await rosterRows.nth(i).click();
      if ((await page.getByText(/ · JR/).count()) > 0) {
        const m = page.url().match(/\/players\/([^?]+)/);
        jrPlayerId = m?.[1] ?? null;
        break;
      }
      await page.goto(`/dashboard/teams/${fixture!.homeTeamId}`);
    }

    await page.goto(`/dashboard/leagues/${leagueId}/schedule`);
    await simToChampion(page);

    await page.goto(`/dashboard/leagues/${leagueId}`);
    await expect(startBtn).toBeEnabled();
    await startBtn.click();
    await expect(page.getByText("Next season started.")).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.getByText(/Offseason · upcoming/)).toBeVisible();
    await expect(page.getByText(/View E2E Season/)).toBeVisible();

    await page.goto("/dashboard/seasons");
    await expect(page.getByText(/E2E Season \d{4}/)).toBeVisible();

    // The graduated-players accordion lives in the DynastyPanel on the league
    // page, not on /dashboard/seasons. A ~48-player-per-team roster spans grades
    // 9–12, so a first rollover reliably graduates seniors.
    await page.goto(`/dashboard/leagues/${leagueId}`);
    const graduated = page.getByRole("button", {
      name: /Graduated players \(\d+\)/,
    });
    await expect(graduated).toBeVisible();
    await graduated.click();
    await expect(graduated).toHaveAttribute("aria-expanded", "true");

    if (jrPlayerId) {
      await page.goto(`/dashboard/players/${jrPlayerId}`);
      await expect(page.getByText(/ · SR/)).toBeVisible();
    }
  });
});

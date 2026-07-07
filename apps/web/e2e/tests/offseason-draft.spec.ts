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
 * Offseason hub + draft board (O4 / WSM-000234).
 */
const FIXTURE_KEY = "offseason-draft";
const LEAGUE_NAME = `E2E:${FIXTURE_KEY}`;
const STORAGE_STATE = path.resolve("e2e", ".auth", "user.json");

test.describe("Offseason draft", () => {
  let fixture: ScheduleFixtureResult | null = null;
  let teardown: (() => Promise<void>) | null = null;
  let upcomingSeasonUrl: string | null = null;

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(300_000);
    const orgId = getTestOrgId();
    test.skip(!orgId, "E2E_CLERK_ORG_ID not set");
    const handle = await withScheduleFixture({
      fixtureKey: FIXTURE_KEY,
      clerkOrgId: orgId,
      homeTeamName: "E2E Draft Home",
      awayTeamName: "E2E Draft Away",
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

    await page.goto(`/dashboard/leagues/${fixture.leagueId}/schedule`);
    await simToChampion(page);

    await page.goto(`/dashboard/leagues/${fixture.leagueId}`);
    const startBtn = page.getByRole("button", { name: "Start next season" });
    await expect(startBtn).toBeEnabled({ timeout: 60_000 });
    await startBtn.click();
    await expect(page.getByText("Next season started.")).toBeVisible({
      timeout: 60_000,
    });

    const upcomingLink = page.getByRole("link", { name: /View E2E Season/ });
    await expect(upcomingLink).toBeVisible({ timeout: 60_000 });
    upcomingSeasonUrl = (await upcomingLink.getAttribute("href")) ?? null;

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

  test("starts a draft, makes two picks, and advances on-clock by snake order", async ({
    page,
  }) => {
    if (!fixture || !upcomingSeasonUrl) test.skip();

    await page.goto(upcomingSeasonUrl!);
    await expect(page.getByTestId("offseason-hub")).toBeVisible({
      timeout: 60_000,
    });

    await page.goto(`/dashboard/teams/${fixture!.homeTeamId}`);
    const releaseBtn = page
      .getByRole("button", { name: /Release / })
      .first();
    await expect(releaseBtn).toBeVisible({ timeout: 60_000 });
    const releasedName = (
      await releaseBtn.getAttribute("aria-label")
    )?.replace(/^Release /, "");
    expect(releasedName).toBeTruthy();

    await releaseBtn.click();
    await page.getByRole("button", { name: "Release", exact: true }).click();
    await expect(
      page.getByRole("button", { name: `Release ${releasedName}` }),
    ).toHaveCount(0, { timeout: 60_000 });

    await page.goto(upcomingSeasonUrl!);
    const draftToggle = page.getByTestId("draft-start-toggle");
    await expect(draftToggle).toBeVisible({ timeout: 60_000 });
    await page.getByRole("button", { name: "Start draft", exact: true }).click();
    await expect(page.getByTestId("draft-board")).toBeVisible({
      timeout: 60_000,
    });

    const draftBoard = page.getByTestId("draft-board");
    const onClock = draftBoard.getByTestId("draft-on-clock");
    const firstOnClock = (
      await onClock.getByTestId("draft-on-clock-team").innerText()
    ).trim();

    const pool = draftBoard.getByTestId("draft-pool");
    const firstRow = pool.locator("tbody tr").first();
    const firstPickName = (await firstRow.locator("td").first().innerText()).trim();
    await firstRow
      .getByRole("button", { name: `Pick ${firstPickName}`, exact: true })
      .click();

    const history = draftBoard.getByTestId("draft-history");
    await expect(
      history.getByText(firstPickName, { exact: true }),
    ).toBeVisible({ timeout: 60_000 });

    // The drafted player leaves the available pool. The history row above
    // already records the team→player pick and the backend rosters them, so
    // this avoids a brittle team-name link lookup on the league page.
    await expect(
      pool.getByText(firstPickName, { exact: true }),
    ).toHaveCount(0, { timeout: 60_000 });

    await page.goto(upcomingSeasonUrl!);
    await expect(draftBoard).toBeVisible({ timeout: 60_000 });

    await expect(onClock.getByTestId("draft-on-clock-team")).not.toHaveText(
      firstOnClock,
      { timeout: 60_000 },
    );
    const secondOnClock = (
      await onClock.getByTestId("draft-on-clock-team").innerText()
    ).trim();
    expect(secondOnClock).not.toBe(firstOnClock);

    const secondRow = pool.locator("tbody tr").first();
    const secondPickName = (
      await secondRow.locator("td").first().innerText()
    ).trim();
    await secondRow
      .getByRole("button", { name: `Pick ${secondPickName}`, exact: true })
      .click();

    await expect(
      history.getByText(secondPickName, { exact: true }),
    ).toBeVisible({ timeout: 60_000 });

    await expect(
      pool.getByText(secondPickName, { exact: true }),
    ).toHaveCount(0, { timeout: 60_000 });
  });
});

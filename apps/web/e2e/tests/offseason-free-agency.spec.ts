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
 * Offseason hub + free agency (O2 / WSM-000232).
 */
const FIXTURE_KEY = "offseason-fa";
const LEAGUE_NAME = `E2E:${FIXTURE_KEY}`;
const STORAGE_STATE = path.resolve("e2e", ".auth", "user.json");

test.describe("Offseason free agency", () => {
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
      homeTeamName: "E2E FA Home",
      awayTeamName: "E2E FA Away",
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

  test("releases a player to the pool and signs them to a team", async ({
    page,
  }) => {
    if (!fixture || !upcomingSeasonUrl) test.skip();

    await page.goto(upcomingSeasonUrl!);
    await expect(page.getByTestId("offseason-hub")).toBeVisible({
      timeout: 60_000,
    });
    await expect(
      page.getByTestId("offseason-phase-stepper"),
    ).toContainText("Free agency");

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
    // Assert the durable outcome (released player leaves the active roster)
    // rather than the transient success toast, which a client re-render can
    // drop before the assertion runs.
    await expect(
      page.getByRole("button", { name: `Release ${releasedName}` }),
    ).toHaveCount(0, { timeout: 60_000 });

    await page.goto(upcomingSeasonUrl!);
    await expect(page.getByTestId("free-agency-panel")).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.getByText(releasedName!)).toBeVisible({ timeout: 60_000 });

    const signBtn = page
      .getByRole("button", { name: "Sign", exact: true })
      .first();
    await signBtn.click();
    await page.getByLabel("Target team").click();
    await page.getByRole("option", { name: fixture!.awayTeamName }).click();
    await page.getByRole("button", { name: "Confirm sign" }).click();
    await expect(page.getByText(/signed/i)).toBeVisible({ timeout: 60_000 });

    await expect(page.getByText(releasedName!)).not.toBeVisible({
      timeout: 60_000,
    });

    await page.goto(`/dashboard/teams/${fixture!.awayTeamId}`);
    await expect(page.getByText(releasedName!)).toBeVisible({
      timeout: 60_000,
    });
  });
});

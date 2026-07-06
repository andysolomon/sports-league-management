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
} from "../helpers/sim-league-setup";

/*
 * Gamecast stepping (Slice C) — simmed fixtures expose play-by-play replay;
 * manually recorded finals show the friendly empty state.
 */
const FIXTURE_KEY = "gamecast";
const LEAGUE_NAME = `E2E:${FIXTURE_KEY}`;
const STORAGE_STATE = path.resolve("e2e", ".auth", "user.json");

test.describe("Gamecast replay (WSM gamecast)", () => {
  let fixture: ScheduleFixtureResult | null = null;
  let teardown: (() => Promise<void>) | null = null;

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(300_000);
    const orgId = getTestOrgId();
    test.skip(!orgId, "E2E_CLERK_ORG_ID not set");
    const handle = await withScheduleFixture({
      fixtureKey: FIXTURE_KEY,
      clerkOrgId: orgId,
      homeTeamName: "E2E GC Home",
      awayTeamName: "E2E GC Away",
    });
    fixture = handle.fixture;
    teardown = handle.teardown;

    const context = await browser.newContext({ storageState: STORAGE_STATE });
    const page = await context.newPage();
    await setupClerkTestingToken({ page });
    acceptBrowserConfirms(page);
    await bootstrapFourTeamSimLeague(page, fixture.leagueId, LEAGUE_NAME);
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

  test("simmed fixture gamecast stepping and manual-final empty state", async ({
    page,
  }) => {
    if (!fixture) test.skip();
    const leagueId = fixture!.leagueId;

    await page.goto(`/dashboard/leagues/${leagueId}/schedule`);
    await expect(
      page.getByRole("heading", { name: LEAGUE_NAME }),
    ).toBeVisible();

    const simRow = page.locator("tbody tr").first();
    const homeName = await simRow.locator("td").nth(1).innerText();
    const awayName = await simRow.locator("td").nth(2).innerText();
    const simFixtureId = await simRow.getAttribute("data-testid");
    expect(simFixtureId).toMatch(/^schedule-fixture-/);

    await page
      .getByRole("button", {
        name: `Simulate ${homeName} vs ${awayName}`,
      })
      .click();
    await expect(simRow.getByText("Final", { exact: true })).toBeVisible({
      timeout: 60_000,
    });

    const scoreText = (await simRow.locator("td").nth(3).innerText()).trim();
    const scoreMatch = scoreText.match(/(\d+)\s*[–-]\s*(\d+)/);
    expect(scoreMatch).not.toBeNull();
    const expectedHome = Number(scoreMatch![1]);
    const expectedAway = Number(scoreMatch![2]);

    await simRow.getByRole("link", { name: "Gamecast" }).click();
    await expect(page).toHaveURL(/\/dashboard\/games\/[^/]+\/gamecast$/);
    await expect(
      page.getByRole("heading", { name: "Gamecast" }),
    ).toBeVisible();
    await expect(page.getByText(homeName).first()).toBeVisible();
    await expect(page.getByText(awayName).first()).toBeVisible();
    await expect(page.locator('svg[aria-label="Drive chart"]')).toBeVisible();

    await expect(
      page.getByText("Press Next play to start the gamecast."),
    ).toBeVisible();

    const playRows = () =>
      page
        .locator('[data-slot="card"]', {
          has: page.getByText("Play-by-play", { exact: true }),
        })
        .locator("ul li");

    await page.getByRole("button", { name: "Next play" }).click();
    await expect(playRows()).not.toHaveCount(0);
    const afterOnePlay = await playRows().count();

    await page.getByRole("button", { name: "Next play" }).click();
    await expect(playRows()).toHaveCount(afterOnePlay + 1);

    await page.getByRole("button", { name: "Next quarter" }).click();
    expect(await playRows().count()).toBeGreaterThan(afterOnePlay);

    await page.getByRole("button", { name: "Entire game" }).click();
    await expect(
      page.getByText("Final", { exact: true }).first(),
    ).toBeVisible();
    await expect(
      page
        .locator(".font-mono.text-stat-30")
        .filter({ hasText: String(expectedHome) })
        .first(),
    ).toBeVisible();
    await expect(
      page
        .locator(".font-mono.text-stat-30")
        .filter({ hasText: String(expectedAway) })
        .first(),
    ).toBeVisible();
    await expect(
      page.getByText(/drive/i).first(),
    ).toBeVisible();

    await page.getByRole("button", { name: "Restart" }).click();
    await expect(
      page.getByText("Press Next play to start the gamecast."),
    ).toBeVisible();

    // Return to the schedule to exercise the manual-record → empty-state path.
    await page.goto(`/dashboard/leagues/${leagueId}/schedule`);
    await expect(
      page.getByRole("heading", { name: LEAGUE_NAME }),
    ).toBeVisible();

    const manualRow = page
      .locator("tbody tr")
      .filter({ has: page.getByText("Scheduled", { exact: true }) })
      .first();
    await expect(manualRow).toBeVisible();
    const manualHome = await manualRow.locator("td").nth(1).innerText();
    const manualAway = await manualRow.locator("td").nth(2).innerText();
    const manualTestId = await manualRow.getAttribute("data-testid");
    expect(manualTestId).toMatch(/^schedule-fixture-/);
    const manualFixtureId = manualTestId!.replace("schedule-fixture-", "");

    await manualRow.getByRole("button", { name: "Record result" }).click();
    const resultDialog = page.getByRole("dialog");
    await resultDialog.getByLabel(new RegExp(manualHome)).fill("14");
    await resultDialog.getByLabel(new RegExp(manualAway)).fill("7");
    await resultDialog.getByRole("button", { name: "Save result" }).click();
    await expect(resultDialog).toBeHidden();
    await expect(manualRow.getByText("Final", { exact: true })).toBeVisible();
    await expect(
      manualRow.getByRole("link", { name: "Gamecast" }),
    ).toHaveCount(0);

    await page.goto(`/dashboard/games/${manualFixtureId}/gamecast`);
    await expect(
      page.getByText(
        "Gamecast is available for simulated games with a stored play-by-play log.",
      ),
    ).toBeVisible();
  });
});

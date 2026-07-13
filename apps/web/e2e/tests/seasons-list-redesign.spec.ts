import { test, expect } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";
import path from "node:path";
import { readCanonicalFixture, setActiveLeague } from "../helpers/seed-canonical";
import { SEASONS, LEAGUES } from "../helpers/test-data";
import {
  withScheduleFixture,
  type ScheduleFixtureResult,
} from "../helpers/seed-schedule";
import { getTestOrgId } from "../helpers/seed-roster";
import {
  acceptBrowserConfirms,
  awaitProcessDialog,
  bootstrapFourTeamSimLeague,
  completeSeason,
  confirmLifecycleDialog,
  simToChampion,
  startNextSeason,
} from "../helpers/sim-league-setup";

const STORAGE_STATE = path.resolve("e2e", ".auth", "user.json");

test.describe("Seasons list redesign — canonical rows (WSM-000255)", () => {
  test.beforeEach(async ({ page }) => {
    await setupClerkTestingToken({ page });
    await setActiveLeague(page, readCanonicalFixture().leagueId);
    await page.goto("/dashboard/seasons");
  });

  test("sorts active season before completed and shows archive meta", async ({
    page,
  }) => {
    const nflCard = page.locator('[data-slot="card"]', {
      has: page.getByText(LEAGUES.NFL),
    });
    const rows = nflCard.locator('[data-testid="season-row"]');
    const names = await rows
      .locator('a[href^="/dashboard/seasons/"]')
      .allTextContents();

    expect(names[0]).toContain(SEASONS.NFL_2025.name);
    expect(names[1]).toContain(SEASONS.NFL_2024.name);

    const activeRow = rows.filter({ hasText: SEASONS.NFL_2025.name });
    await expect(activeRow.getByText(SEASONS.NFL_2025.status, { exact: true })).toBeVisible();
    await expect(activeRow.getByText("No games yet")).toBeVisible();

    const completedRow = rows.filter({ hasText: SEASONS.NFL_2024.name });
    await expect(
      completedRow.getByText(SEASONS.NFL_2024.status, { exact: true }),
    ).toBeVisible();
    await expect(completedRow.getByText("No games yet")).toBeVisible();
  });

  test("new season dialog requires a name then offers schedule shortcut", async ({
    page,
  }) => {
    const nflCard = page.locator('[data-slot="card"]', {
      has: page.getByText(LEAGUES.NFL),
    });
    await nflCard.getByRole("button", { name: "New season" }).click();

    const dialog = page.getByRole("dialog", { name: "New season" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByTestId("create-season-submit")).toBeDisabled();

    const seasonName = `E2E Season ${Date.now()}`;
    await dialog.getByLabel("Season name").fill(seasonName);
    await expect(dialog.getByTestId("create-season-submit")).toBeEnabled();
    await dialog.getByTestId("create-season-submit").click();

    const success = page.getByRole("dialog", { name: "Season created" });
    await expect(success).toBeVisible({ timeout: 30_000 });
    await expect(success.getByText(
      `Created ${seasonName}. Rosters start empty (0/48).`,
    )).toBeVisible();

    await success.getByTestId("create-season-generate-schedule").click();
    await expect(page).toHaveURL(/\/dashboard\/leagues\/[^/]+\/schedule/);
  });
});

test.describe("Seasons list redesign — lifecycle actions (WSM-000255)", () => {
  test.describe.configure({ mode: "serial" });

  const FIXTURE_KEY = "seasons-list-redesign";
  const LEAGUE_NAME = `E2E:${FIXTURE_KEY}`;

  let fixture: ScheduleFixtureResult | null = null;
  let teardown: (() => Promise<void>) | null = null;
  let upcomingSeasonName: string | null = null;

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(300_000);
    const orgId = getTestOrgId();
    test.skip(!orgId, "E2E_CLERK_ORG_ID not set");
    const handle = await withScheduleFixture({
      fixtureKey: FIXTURE_KEY,
      clerkOrgId: orgId,
      homeTeamName: "E2E SL Home",
      awayTeamName: "E2E SL Away",
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
    await simToChampion(page);
    await completeSeason(page, fixture.seasonId);
    await page.goto(`/dashboard/leagues/${fixture.leagueId}`);
    await startNextSeason(page);
    const upcomingLink = page.getByRole("link", { name: /View E2E Season/ });
    await expect(upcomingLink).toBeVisible({ timeout: 60_000 });
    upcomingSeasonName = (await upcomingLink.textContent())?.replace(/^View /, "") ?? null;
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

  test("completed season row shows games progress and champion trophy", async ({
    page,
  }) => {
    if (!fixture) test.skip();
    await page.goto("/dashboard/seasons");
    const card = page.locator('[data-slot="card"]', { hasText: LEAGUE_NAME });
    const completedRow = card.locator('[data-testid="season-row"]').filter({
      hasText: "E2E Season",
      has: page.getByText("Completed", { exact: true }),
    });
    await expect(completedRow).toBeVisible();
    await expect(completedRow.getByText(/\d+ \/ \d+ games/)).toBeVisible();
    await expect(completedRow.locator("svg.lucide-trophy")).toBeVisible();
  });

  test("make active shows undersized roster dialog and auto-fill path", async ({
    page,
  }) => {
    if (!fixture || !upcomingSeasonName) test.skip();
    await page.goto("/dashboard/seasons");
    const card = page.locator('[data-slot="card"]', { hasText: LEAGUE_NAME });
    const upcomingRow = card.locator('[data-testid="season-row"]').filter({
      hasText: upcomingSeasonName!,
    });
    await upcomingRow
      .getByRole("button", { name: `Make ${upcomingSeasonName} active` })
      .click();

    const warning = page.getByTestId("activate-season-warning-dialog");
    await expect(warning).toBeVisible();
    await expect(warning.getByText(/\(0\/48\)/)).toBeVisible();
    await expect(warning.getByTestId("activate-season-autofill")).toBeVisible();

    await warning.getByTestId("activate-season-autofill").click();
    await awaitProcessDialog(page, { timeout: 180_000 });
    await expect(page.getByText(/is now the active season\./)).toBeVisible({
      timeout: 60_000,
    });
  });

  test("complete season opens confirmation dialogs", async ({ page }) => {
    if (!fixture || !upcomingSeasonName) test.skip();
    await page.goto("/dashboard/seasons");
    const card = page.locator('[data-slot="card"]', { hasText: LEAGUE_NAME });
    const activeRow = card.locator('[data-testid="season-row"]').filter({
      hasText: upcomingSeasonName!,
    });
    await activeRow
      .getByRole("button", { name: `Complete ${upcomingSeasonName}` })
      .click();

    await confirmLifecycleDialog(page, { name: "Complete season anyway?" });
    await expect(page.getByText(/completed\./)).toBeVisible({ timeout: 60_000 });
  });
});

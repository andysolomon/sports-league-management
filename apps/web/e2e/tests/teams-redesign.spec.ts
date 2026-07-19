import { test, expect } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";
import path from "node:path";
import {
  withScheduleFixture,
  type ScheduleFixtureResult,
} from "../helpers/seed-schedule";
import { readCanonicalFixture, setActiveLeague } from "../helpers/seed-canonical";
import { getTestOrgId } from "../helpers/seed-roster";
import { TEAMS } from "../helpers/test-data";
import {
  acceptBrowserConfirms,
  bootstrapFourTeamSimLeague,
  simWeek,
} from "../helpers/sim-league-setup";

const STORAGE_STATE = path.resolve("e2e", ".auth", "user.json");

test.describe("Teams table redesign — canonical league (WSM-000248)", () => {
  test.beforeEach(async ({ page }) => {
    await setupClerkTestingToken({ page });
    const canonical = readCanonicalFixture();
    test.skip(!canonical, "canonical fixture not seeded");
    await setActiveLeague(page, canonical!.leagueId);
    await page.goto("/dashboard/teams");
  });

  test("renders ranked table with canonical teams", async ({ page }) => {
    const main = page.locator("#main-content");
    await expect(main.getByRole("heading", { name: "Teams" })).toBeVisible();
    await expect(main.getByTestId("teams-table")).toBeVisible();
    await expect(
      main.getByRole("row", { name: new RegExp(TEAMS.COWBOYS.name) }),
    ).toBeVisible();
    await expect(
      main.getByRole("row", { name: new RegExp(TEAMS.PATRIOTS.name) }),
    ).toBeVisible();
  });

  test("Quick View remains an explicit secondary action", async ({ page }) => {
    const main = page.locator("#main-content");
    const cowboysRow = main.getByRole("row", {
      name: new RegExp(TEAMS.COWBOYS.name),
    });
    await expect(cowboysRow).toBeVisible();
    await cowboysRow
      .getByRole("button", { name: `Quick view ${TEAMS.COWBOYS.name}` })
      .click();
    const sheet = page.getByTestId("team-detail-sheet");
    await expect(sheet).toBeVisible();
    await expect(sheet.getByText(TEAMS.COWBOYS.name)).toBeVisible();
  });

  test("team name is the primary Team Home destination", async ({ page }) => {
    const main = page.locator("#main-content");
    await main.getByRole("link", { name: TEAMS.COWBOYS.name }).click();
    await expect(
      page.getByTestId("resource-header-team").getByText(TEAMS.COWBOYS.name),
    ).toBeVisible();
  });
});

test.describe("Teams table redesign — fixture league records (WSM-000248)", () => {
  test.describe.configure({ mode: "serial" });

  const FIXTURE_KEY = "teams-table-redesign";
  const LEAGUE_NAME = `E2E:${FIXTURE_KEY}`;

  let fixture: ScheduleFixtureResult | null = null;
  let teardown: (() => Promise<void>) | null = null;

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(300_000);
    const orgId = getTestOrgId();
    test.skip(!orgId, "E2E_CLERK_ORG_ID not set");
    const handle = await withScheduleFixture({
      fixtureKey: FIXTURE_KEY,
      clerkOrgId: orgId,
      homeTeamName: "E2E TT Home",
      awayTeamName: "E2E TT Away",
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
    await simWeek(page, 1);
    await context.close();
  });

  test.afterAll(async () => {
    if (teardown) await teardown();
  });

  test.beforeEach(async ({ page }) => {
    test.setTimeout(120_000);
    await setupClerkTestingToken({ page });
    if (!fixture) test.skip();
    await setActiveLeague(page, fixture!.leagueId);
  });

  test("detail sheet shows record and form after week 1 is simulated", async ({
    page,
  }) => {
    await page.goto("/dashboard/teams");
    const main = page.locator("#main-content");
    const homeRow = main.getByRole("row", { name: /E2E TT Home/ });
    await expect(homeRow).toBeVisible();
    await expect(homeRow).toContainText(/\d+-\d+/);
    await homeRow
      .getByRole("button", { name: "Quick view E2E TT Home" })
      .click();
    const sheet = page.getByTestId("team-detail-sheet");
    await expect(sheet).toBeVisible();
    await expect(sheet.getByText("E2E TT Home")).toBeVisible();
    await expect(sheet.getByText(/\d+-\d+/)).toBeVisible();
    await expect(sheet.getByText("Form · last 5")).toBeVisible();
    await expect(
      sheet.locator("span").filter({ hasText: /^[WLT]$/ }).first(),
    ).toBeVisible();
  });
});

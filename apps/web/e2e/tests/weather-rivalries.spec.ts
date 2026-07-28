import { test, expect } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";
import {
  withScheduleFixture,
  type ScheduleFixtureResult,
} from "../helpers/seed-schedule";
import { getTestOrgId } from "../helpers/seed-roster";
import { setActiveLeague } from "../helpers/seed-canonical";
import { pickSelectOption } from "../helpers/select";

/*
 * Weather and rivalries (A5).
 *
 * Runs in its own fixture league rather than the canonical one. A declared
 * rivalry changes how a matchup simulates, so leaving one behind in the shared
 * league would quietly alter unrelated specs' results.
 */
const FIXTURE_KEY = "weather";
const HOME_TEAM = "E2E Wx Home";
const AWAY_TEAM = "E2E Wx Away";

test.describe("Weather and rivalries (A5)", () => {
  let fixture: ScheduleFixtureResult | null = null;
  let teardown: (() => Promise<void>) | null = null;

  test.beforeAll(async () => {
    const orgId = getTestOrgId();
    test.skip(!orgId, "E2E_CLERK_ORG_ID not set");
    const handle = await withScheduleFixture({
      fixtureKey: FIXTURE_KEY,
      clerkOrgId: orgId,
      homeTeamName: HOME_TEAM,
      awayTeamName: AWAY_TEAM,
    });
    fixture = handle.fixture;
    teardown = handle.teardown;
  });

  test.afterAll(async () => {
    if (teardown) await teardown();
  });

  test.beforeEach(async ({ page }) => {
    await setupClerkTestingToken({ page });
  });

  test("the schedule shows a forecast for a game that has not been played", async ({
    page,
  }) => {
    if (!fixture) test.skip();

    await page.goto(`/dashboard/seasons/${fixture!.seasonId}/schedule`);
    await page.getByRole("button", { name: "New fixture" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await pickSelectOption(page, "#fix-home", HOME_TEAM);
    await pickSelectOption(page, "#fix-away", AWAY_TEAM);
    // The chip is derived from season, week and venue, so a week is required.
    await dialog.getByLabel("Week").fill("1");
    await dialog.getByRole("button", { name: "Create fixture" }).click();
    await expect(dialog).toBeHidden();

    const chip = page.getByTestId("weather-chip").first();
    await expect(chip).toBeVisible();
    // Forecast, not a record of what happened — the Gamecast reads the real
    // conditions off the stored log instead.
    await expect(chip).toHaveAttribute("data-weather-variant", "forecast");
    await expect(chip).toHaveAccessibleName(/^Forecast: /);
  });

  test("an admin can declare and remove a rivalry", async ({ page }) => {
    if (!fixture) test.skip();

    // League Settings is scoped to the Active League, so point the cookie at
    // this spec's isolated league rather than the canonical one.
    await setActiveLeague(page, fixture!.leagueId);
    await page.goto("/dashboard/settings/league");

    const card = page.getByTestId("rivalries-settings");
    await expect(card).toBeVisible();
    await expect(page.getByTestId("rivalries-empty")).toBeVisible();

    // Native <select> elements here, not the Radix combobox the fixture
    // dialog uses — so drive them with selectOption rather than pickSelectOption.
    await page.getByTestId("rivalry-team-a").selectOption({ label: HOME_TEAM });
    await page.getByTestId("rivalry-team-b").selectOption({ label: AWAY_TEAM });
    await page.getByTestId("rivalry-name").fill("The E2E Bowl");
    await page.getByTestId("rivalry-intensity").fill("80");
    await page.getByTestId("rivalry-save").click();

    const row = page.getByTestId("rivalry-row");
    await expect(row).toHaveCount(1);
    await expect(row).toContainText(HOME_TEAM);
    await expect(row).toContainText(AWAY_TEAM);
    await expect(row).toContainText("The E2E Bowl");
    await expect(row).toContainText("80");

    await page.getByTestId("rivalry-remove").click();
    await expect(page.getByTestId("rivalries-empty")).toBeVisible();
  });
});

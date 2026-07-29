import { test, expect } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";
import {
  seedAiHeadCoachesForLeague,
  withScheduleFixture,
  type ScheduleFixtureResult,
} from "../helpers/seed-schedule";
import { getTestOrgId } from "../helpers/seed-roster";

/*
 * Coach Home (Dynasty Mode C1, #625).
 *
 * Isolated fixture league; both teams receive AI head coaches before assertions.
 */
test.describe("Coach Home (C1)", () => {
  test.describe.configure({ mode: "serial" });

  const FIXTURE_KEY = "coach-home";
  const LEAGUE_NAME = `E2E:${FIXTURE_KEY}`;

  let fixture: ScheduleFixtureResult | null = null;
  let teardown: (() => Promise<void>) | null = null;
  let homeCoachId: string | null = null;

  test.beforeAll(async () => {
    const orgId = getTestOrgId();
    test.skip(!orgId, "E2E_CLERK_ORG_ID not set");
    const handle = await withScheduleFixture({
      fixtureKey: FIXTURE_KEY,
      clerkOrgId: orgId,
      homeTeamName: "E2E CH Home",
      awayTeamName: "E2E CH Away",
    });
    fixture = handle.fixture;
    teardown = handle.teardown;

    await seedAiHeadCoachesForLeague(fixture.leagueId);
    await seedAiHeadCoachesForLeague(fixture.leagueId);
  });

  test.afterAll(async () => {
    if (teardown) await teardown();
  });

  test.beforeEach(async ({ page }) => {
    await setupClerkTestingToken({ page });
  });

  test("Team Home Staff card links to Coach Home with ResourceHeader siblings", async ({
    page,
  }) => {
    if (!fixture) {
      test.skip();
      return;
    }

    await page.goto(`/dashboard/teams/${fixture.homeTeamId}`);
    const staffCard = page.getByTestId("team-staff-card");
    await expect(staffCard).toBeVisible({ timeout: 30_000 });

    const coachLink = staffCard.getByRole("link").first();
    await coachLink.click();

    const header = page.getByTestId("resource-header-coach");
    await expect(header).toBeVisible({ timeout: 30_000 });

    const overview = header.getByRole("link", { name: "Overview", exact: true });
    await expect(overview).toHaveAttribute("aria-current", "page");

    homeCoachId = new URL(page.url()).pathname.split("/").pop() ?? null;
    expect(homeCoachId).toBeTruthy();
  });

  test("Career sibling is active on the career route", async ({ page }) => {
    if (!fixture || !homeCoachId) {
      test.skip();
      return;
    }

    await page.goto(`/dashboard/coaches/${homeCoachId}/career`);
    const header = page.getByTestId("resource-header-coach");
    await expect(header).toBeVisible({ timeout: 30_000 });

    const career = header.getByRole("link", { name: "Career", exact: true });
    await expect(career).toHaveAttribute("aria-current", "page");
  });
});

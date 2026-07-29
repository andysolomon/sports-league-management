import { test, expect } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";
import {
  seedAiHeadCoachesForLeague,
  withScheduleFixture,
  type ScheduleFixtureResult,
} from "../helpers/seed-schedule";
import { getTestOrgId } from "../helpers/seed-roster";

/*
 * Season goals card (Dynasty Mode C2, #626).
 *
 * Both fixture teams are seeded; Season Home resolves the acting team as the
 * first team in getTeamsByLeague sort order (alphabetical by name).
 */
test.describe("Season goals card (C2)", () => {
  test.describe.configure({ mode: "serial" });

  const FIXTURE_KEY = "season-goals";
  const LEAGUE_NAME = `E2E:${FIXTURE_KEY}`;

  let fixture: ScheduleFixtureResult | null = null;
  let teardown: (() => Promise<void>) | null = null;

  test.beforeAll(async () => {
    const orgId = getTestOrgId();
    test.skip(!orgId, "E2E_CLERK_ORG_ID not set");
    const handle = await withScheduleFixture({
      fixtureKey: FIXTURE_KEY,
      clerkOrgId: orgId,
      homeTeamName: "E2E SG Away",
      awayTeamName: "E2E SG Home",
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

  test("renders season goals with progress for a team with goals", async ({
    page,
  }) => {
    if (!fixture) {
      test.skip();
      return;
    }

    await page.goto(`/dashboard/seasons/${fixture.seasonId}`);
    const card = page.getByTestId("season-goals-card");
    await expect(card).toBeVisible({ timeout: 30_000 });
    await expect(card.getByText("Season goals")).toBeVisible();
    await expect(card.getByText(/goals on track/)).toBeVisible();
  });
});

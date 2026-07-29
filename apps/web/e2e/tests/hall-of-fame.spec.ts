import { test, expect } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";
import {
  seedHallOfFameFixture,
  withScheduleFixture,
  type ScheduleFixtureResult,
} from "../helpers/seed-schedule";
import { getTestOrgId } from "../helpers/seed-roster";

test.describe("League Hall of Fame (D5)", () => {
  test.describe.configure({ mode: "serial" });

  const FIXTURE_KEY = "history-hall-of-fame";
  let fixture: ScheduleFixtureResult | null = null;
  let classLabel = "";
  let teardown: (() => Promise<void>) | null = null;

  test.beforeAll(async () => {
    const orgId = getTestOrgId();
    test.skip(!orgId, "E2E_CLERK_ORG_ID not set");
    const handle = await withScheduleFixture({
      fixtureKey: FIXTURE_KEY,
      clerkOrgId: orgId,
      homeTeamName: "E2E HoF Home",
      awayTeamName: "E2E HoF Away",
    });
    fixture = handle.fixture;
    teardown = handle.teardown;
    const seeded = await seedHallOfFameFixture(fixture);
    classLabel = seeded.classLabel;
  });

  test.afterAll(async () => {
    if (teardown) await teardown();
  });

  test.beforeEach(async ({ page }) => {
    await setupClerkTestingToken({ page });
  });

  test("renders its class on League history", async ({ page }) => {
    if (!fixture) {
      test.skip();
      return;
    }

    await page.goto(`/dashboard/leagues/${fixture.leagueId}/history`);
    const hall = page.getByTestId("hall-of-fame");
    await expect(hall).toBeVisible({ timeout: 30_000 });
    await expect(
      hall.getByRole("heading", { name: "Hall of Fame", exact: true }),
    ).toBeVisible();
    await expect(hall.getByText(classLabel, { exact: true })).toBeVisible();
    await expect(hall.getByText("E2E Home Legend", { exact: true })).toBeVisible();
    await expect(hall.getByText("E2E Away Legend", { exact: true })).toBeVisible();
  });
});

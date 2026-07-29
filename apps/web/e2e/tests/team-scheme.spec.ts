import { test, expect } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";
import {
  withScheduleFixture,
  type ScheduleFixtureResult,
} from "../helpers/seed-schedule";
import { getTestOrgId } from "../helpers/seed-roster";

test.describe("Team scheme selection (C3 / A6 gap)", () => {
  test.describe.configure({ mode: "serial" });

  const FIXTURE_KEY = "team-scheme";
  let fixture: ScheduleFixtureResult | null = null;
  let teardown: (() => Promise<void>) | null = null;

  test.beforeAll(async () => {
    const orgId = getTestOrgId();
    test.skip(!orgId, "E2E_CLERK_ORG_ID not set");
    const handle = await withScheduleFixture({
      fixtureKey: FIXTURE_KEY,
      clerkOrgId: orgId,
      homeTeamName: "E2E Scheme Home",
      awayTeamName: "E2E Scheme Away",
    });
    fixture = handle.fixture;
    teardown = handle.teardown;
  });

  test.afterAll(async () => {
    await teardown?.();
  });

  test("saves from Team Home and allows a low-fit scheme", async ({ page }) => {
    test.skip(!fixture, "fixture not ready");
    await setupClerkTestingToken({ page });

    await page.goto(`/dashboard/teams/${fixture!.homeTeamId}`);
    const card = page.getByTestId("team-scheme-card");
    await expect(card).toBeVisible({ timeout: 30_000 });

    await page.getByTestId("team-scheme-offense").selectOption("air_raid");
    await page.getByTestId("team-scheme-defense").selectOption("four_two_five");
    await page.getByTestId("team-scheme-save").click();
    await expect(page.getByText("Scheme saved.")).toBeVisible();

    await page.getByTestId("team-scheme-offense").selectOption("flexbone");
    await page.getByTestId("team-scheme-save").click();
    await expect(page.getByText("Scheme saved.")).toBeVisible();
    await expect(page.getByTestId("team-scheme-offense")).toHaveValue("flexbone");
  });
});

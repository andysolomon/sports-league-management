import { test, expect } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";
import {
  seedRankingsFixture,
  withScheduleFixture,
  type ScheduleFixtureResult,
} from "../helpers/seed-schedule";
import { getTestOrgId } from "../helpers/seed-roster";

test.describe("Weekly power rankings (D3)", () => {
  test.describe.configure({ mode: "serial" });

  const FIXTURE_KEY = "season-rankings";
  let fixture: ScheduleFixtureResult | null = null;
  let teardown: (() => Promise<void>) | null = null;

  test.beforeAll(async () => {
    const orgId = getTestOrgId();
    test.skip(!orgId, "E2E_CLERK_ORG_ID not set");
    const handle = await withScheduleFixture({
      fixtureKey: FIXTURE_KEY,
      clerkOrgId: orgId,
      homeTeamName: "E2E Rankings Home",
      awayTeamName: "E2E Rankings Away",
    });
    fixture = handle.fixture;
    teardown = handle.teardown;

    const seeded = await seedRankingsFixture(fixture);
    expect(seeded.rankingsCreated).toBe(2);
  });

  test.afterAll(async () => {
    if (teardown) await teardown();
  });

  test.beforeEach(async ({ page }) => {
    await setupClerkTestingToken({ page });
  });

  test("renders the weekly poll and both seeded teams", async ({ page }) => {
    if (!fixture) {
      test.skip();
      return;
    }

    await page.goto(`/dashboard/seasons/${fixture.seasonId}/rankings`);
    const rankings = page.getByTestId("season-rankings");
    await expect(rankings).toBeVisible({ timeout: 30_000 });
    // `CardTitle` renders a div, not a heading element, so `getByRole("heading")`
    // never matches it. Assert on the text, scoped to the container.
    await expect(rankings.getByText("Week 1 poll", { exact: true })).toBeVisible();
    await expect(
      rankings.getByRole("link", {
        name: fixture.homeTeamName,
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      rankings.getByRole("link", {
        name: fixture.awayTeamName,
        exact: true,
      }),
    ).toBeVisible();
    const header = rankings.getByTestId("resource-header-season");
    await expect(
      header.getByRole("link", { name: "Rankings", exact: true }),
    ).toHaveAttribute("aria-current", "page");
  });
});

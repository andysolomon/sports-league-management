import { test, expect } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";
import {
  seedNewsRecapFixture,
  withScheduleFixture,
  type ScheduleFixtureResult,
} from "../helpers/seed-schedule";
import { getTestOrgId } from "../helpers/seed-roster";

test.describe("Dynasty news and season recap (D4)", () => {
  test.describe.configure({ mode: "serial" });

  const FIXTURE_KEY = "dynasty-news-recap";
  let fixture: ScheduleFixtureResult | null = null;
  let incompleteSeasonId: string | null = null;
  let teardown: (() => Promise<void>) | null = null;

  test.beforeAll(async () => {
    const orgId = getTestOrgId();
    test.skip(!orgId, "E2E_CLERK_ORG_ID not set");
    const handle = await withScheduleFixture({
      fixtureKey: FIXTURE_KEY,
      clerkOrgId: orgId,
      homeTeamName: "E2E News Home",
      awayTeamName: "E2E News Away",
    });
    fixture = handle.fixture;
    teardown = handle.teardown;

    const seeded = await seedNewsRecapFixture(fixture);
    incompleteSeasonId = seeded.incompleteSeasonId;
    expect(seeded.eventsCreated).toBe(3);
    expect(seeded.blocksCreated).toBeGreaterThan(0);
  });

  test.afterAll(async () => {
    if (teardown) await teardown();
  });

  test.beforeEach(async ({ page }) => {
    await setupClerkTestingToken({ page });
  });

  test("renders the same stable news order on League and Season Home", async ({
    page,
  }) => {
    if (!fixture) {
      test.skip();
      return;
    }

    await page.goto(`/dashboard/leagues/${fixture.leagueId}`);
    const leagueFeed = page.getByTestId("dynasty-news-feed");
    await expect(leagueFeed).toBeVisible({ timeout: 30_000 });
    const leagueHeadlines = await leagueFeed
      .locator('[data-testid="dynasty-news-item"] > p:first-child')
      .allTextContents();

    await page.goto(`/dashboard/seasons/${fixture.seasonId}`);
    const seasonFeed = page.getByTestId("dynasty-news-feed");
    await expect(seasonFeed).toBeVisible({ timeout: 30_000 });
    const seasonHeadlines = await seasonFeed
      .locator('[data-testid="dynasty-news-item"] > p:first-child')
      .allTextContents();

    expect(seasonHeadlines).toEqual(leagueHeadlines);
    expect(seasonHeadlines).toHaveLength(3);
  });

  test("links and renders recap only for the completed season", async ({
    page,
  }) => {
    if (!fixture || !incompleteSeasonId) {
      test.skip();
      return;
    }

    await page.goto(`/dashboard/seasons/${fixture.seasonId}`);
    const completedHeader = page.getByTestId("resource-header-season");
    await expect(
      completedHeader.getByRole("link", { name: "Recap", exact: true }),
    ).toBeVisible();

    await page.goto(`/dashboard/seasons/${fixture.seasonId}/recap`);
    const recap = page.getByTestId("season-recap");
    await expect(recap).toBeVisible({ timeout: 30_000 });
    await expect(recap.getByTestId("recap-storyline").first()).toBeVisible();

    await page.goto(`/dashboard/seasons/${incompleteSeasonId}`);
    const activeHeader = page.getByTestId("resource-header-season");
    await expect(
      activeHeader.getByRole("link", { name: "Recap", exact: true }),
    ).toHaveCount(0);

    await page.goto(`/dashboard/seasons/${incompleteSeasonId}/recap`);
    await expect(page.getByTestId("season-recap")).toHaveCount(0);
  });
});

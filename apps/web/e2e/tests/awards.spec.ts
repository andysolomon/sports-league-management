import { test, expect } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";
import {
  seedAwardsFixture,
  withScheduleFixture,
  type ScheduleFixtureResult,
} from "../helpers/seed-schedule";
import { getTestOrgId } from "../helpers/seed-roster";

test.describe("Season awards (D2)", () => {
  test.describe.configure({ mode: "serial" });

  const FIXTURE_KEY = "season-awards";
  let fixture: ScheduleFixtureResult | null = null;
  let winnerPlayerId: string | null = null;
  let teardown: (() => Promise<void>) | null = null;

  test.beforeAll(async () => {
    const orgId = getTestOrgId();
    test.skip(!orgId, "E2E_CLERK_ORG_ID not set");
    const handle = await withScheduleFixture({
      fixtureKey: FIXTURE_KEY,
      clerkOrgId: orgId,
      homeTeamName: "E2E Awards Home",
      awayTeamName: "E2E Awards Away",
    });
    fixture = handle.fixture;
    teardown = handle.teardown;

    const seeded = await seedAwardsFixture(fixture);
    winnerPlayerId = seeded.winnerPlayerId;
    expect(seeded.awardsCreated).toBeGreaterThan(0);
  });

  test.afterAll(async () => {
    if (teardown) await teardown();
  });

  test.beforeEach(async ({ page }) => {
    await setupClerkTestingToken({ page });
  });

  test("renders the slate and lists the winner on Player Overview", async ({
    page,
  }) => {
    if (!fixture || !winnerPlayerId) {
      test.skip();
      return;
    }

    await page.goto(`/dashboard/seasons/${fixture.seasonId}/awards`);
    const awards = page.getByTestId("season-awards");
    await expect(awards).toBeVisible({ timeout: 30_000 });
    await expect(
      awards.getByRole("heading", { name: "Award winners", exact: true }),
    ).toBeVisible();
    await expect(
      awards.getByRole("heading", {
        name: "All-Conference team",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      awards.getByRole("heading", { name: "All-State team", exact: true }),
    ).toBeVisible();
    const header = awards.getByTestId("resource-header-season");
    await expect(
      header.getByRole("link", { name: "Awards", exact: true }),
    ).toHaveAttribute("aria-current", "page");

    await page.goto(`/dashboard/players/${winnerPlayerId}`);
    const accolades = page.getByTestId("player-accolades");
    await expect(accolades).toBeVisible({ timeout: 30_000 });
    await expect(
      accolades.getByText("Player of the Year", { exact: true }),
    ).toBeVisible();
  });
});

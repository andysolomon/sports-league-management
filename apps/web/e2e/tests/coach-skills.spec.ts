import { test, expect } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";
import {
  grantCoachSkillPoints,
  listCoachIdsForTeam,
  seedAiHeadCoachesForLeague,
  withScheduleFixture,
  type ScheduleFixtureResult,
} from "../helpers/seed-schedule";
import { getTestOrgId, getTestOrgIdB } from "../helpers/seed-roster";
import { signInTestUser } from "../helpers/clerk-signin";

test.describe("Coach skill tree (C4)", () => {
  test.describe.configure({ mode: "serial" });

  const FIXTURE_KEY = "coach-skills";
  const LEAGUE_NAME = `E2E:${FIXTURE_KEY}`;

  let fixture: ScheduleFixtureResult | null = null;
  let teardown: (() => Promise<void>) | null = null;
  let homeCoachId: string | null = null;
  let awayCoachId: string | null = null;

  test.beforeAll(async () => {
    const orgId = getTestOrgId();
    test.skip(!orgId, "E2E_CLERK_ORG_ID not set");
    const handle = await withScheduleFixture({
      fixtureKey: FIXTURE_KEY,
      clerkOrgId: orgId,
      homeTeamName: "E2E CS Home",
      awayTeamName: "E2E CS Away",
    });
    fixture = handle.fixture;
    teardown = handle.teardown;

    await seedAiHeadCoachesForLeague(fixture.leagueId);
    const homeCoaches = await listCoachIdsForTeam(fixture.homeTeamId);
    const awayCoaches = await listCoachIdsForTeam(fixture.awayTeamId);
    homeCoachId = homeCoaches[0] ?? null;
    awayCoachId = awayCoaches[0] ?? null;
    if (homeCoachId) await grantCoachSkillPoints(homeCoachId, 3);
  });

  test.afterAll(async () => {
    if (teardown) await teardown();
  });

  test.beforeEach(async ({ page }) => {
    await setupClerkTestingToken({ page });
  });

  test("org admin spends a skill point on Coach Home", async ({ page }) => {
    if (!fixture || !homeCoachId) test.skip();

    await page.goto(`/dashboard/coaches/${homeCoachId}`);
    const tree = page.getByTestId("coach-skill-tree");
    await expect(tree).toBeVisible({ timeout: 30_000 });

    const unlock = page.getByTestId("skill-spend-dev_fundamentals");
    await expect(unlock).toBeEnabled();
    await unlock.click();

    await expect(
      page.getByTestId("skill-node-dev_fundamentals").getByRole("button", {
        name: "Owned",
      }),
    ).toBeVisible({ timeout: 30_000 });
  });

  // This block signs in as the org-B user itself, so it must not inherit the
  // shared signed-in storageState — `clerk.signIn` throws "already signed in"
  // otherwise (WSM-000172). Start from a clean, signed-out context. Nesting
  // keeps the outer fixture's beforeAll/afterAll, so the coach ids still exist.
  test.describe("as a coach outside the league org", () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test("cannot spend on another program's coach", async ({ page }) => {
      const orgIdB = getTestOrgIdB();
      test.skip(!orgIdB || !awayCoachId, "E2E_CLERK_ORG_ID_B required");
      await signInTestUser(page, { userVariant: "B" });
      await page.goto(`/dashboard/coaches/${awayCoachId}`);
      await expect(page.getByRole("heading", { name: /^404$/ })).toBeVisible();
      await expect(page.getByTestId("coach-skill-tree")).toHaveCount(0);
    });
  });
});

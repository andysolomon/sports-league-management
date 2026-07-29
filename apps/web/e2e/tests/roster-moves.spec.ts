import { test, expect } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";
import {
  seedRosterMoveCandidates,
  withScheduleFixture,
  type ScheduleFixtureResult,
} from "../helpers/seed-schedule";
import { getTestOrgId } from "../helpers/seed-roster";
import { acceptBrowserConfirms } from "../helpers/sim-league-setup";

/*
 * Roster shaping (Dynasty Mode B5, #623).
 *
 * Its own fixture league, for the reason `offseason-phases.spec.ts` records:
 * the canonical shared league's season statuses churn between CI runs, and
 * everything here needs an UPCOMING season.
 *
 * The roster is seeded — a weak senior starting ahead of strong sophomores —
 * but every MOVE goes through the real button, the real action and the real
 * mutation. Seeding the moves would test nothing.
 */
test.describe("Roster moves (B5)", () => {
  test.describe.configure({ mode: "serial" });

  const FIXTURE_KEY = "roster-moves";
  const LEAGUE_NAME = `E2E:${FIXTURE_KEY}`;

  let fixture: ScheduleFixtureResult | null = null;
  let teardown: (() => Promise<void>) | null = null;
  let seasonId: string | null = null;

  test.beforeAll(async () => {
    const orgId = getTestOrgId();
    test.skip(!orgId, "E2E_CLERK_ORG_ID not set");
    const handle = await withScheduleFixture({
      fixtureKey: FIXTURE_KEY,
      clerkOrgId: orgId,
      homeTeamName: "E2E RM Home",
      awayTeamName: "E2E RM Away",
    });
    fixture = handle.fixture;
    teardown = handle.teardown;
  });

  test.afterAll(async () => {
    if (teardown) await teardown();
  });

  test.beforeEach(async ({ page }) => {
    test.setTimeout(120_000);
    await setupClerkTestingToken({ page });
    acceptBrowserConfirms(page);
  });

  test("the panel recommends the sophomore starting behind a weaker senior", async ({
    page,
  }) => {
    if (!fixture) {
      test.skip();
      return;
    }

    await page.goto("/dashboard/seasons");
    const card = page.locator('[data-slot="card"]', { hasText: LEAGUE_NAME });
    await card.getByRole("button", { name: "New season" }).click();

    const dialog = page.getByRole("dialog", { name: "New season" });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Season name").fill(`E2E Roster ${Date.now()}`);
    await dialog.getByTestId("create-season-submit").click();

    const success = page.getByRole("dialog", { name: "Season created" });
    await expect(success).toBeVisible({ timeout: 30_000 });
    const href = await success
      .getByTestId("create-season-generate-schedule")
      .getAttribute("href");
    seasonId = href?.split("/")[3] ?? null;
    expect(seasonId).toBeTruthy();
    await success.getByRole("button", { name: "Done" }).click();

    /*
     * BOTH teams, not just the home one. The hub acts for the first team the
     * viewer manages in `getTeamsByLeague` order, which is not the fixture's
     * home-first order — B4's first CI run proved that the hard way. Seeding
     * both means the spec never depends on which one the query returned first.
     */
    await seedRosterMoveCandidates(seasonId as string, fixture.homeTeamId, 3);
    await seedRosterMoveCandidates(seasonId as string, fixture.awayTeamId, 3);

    await page.goto(`/dashboard/seasons/${seasonId}/offseason`);
    const panel = page.getByTestId("promotions-panel");
    await expect(panel).toBeVisible({ timeout: 30_000 });

    // The recommendation has to make its COMPARATIVE argument on screen — a
    // bare name would give the coach nothing to weigh.
    const recommendations = page.getByTestId("promotion-recommendations");
    await expect(
      recommendations.getByTestId("promotion-recommendation").first(),
    ).toBeVisible({ timeout: 30_000 });
    await expect(recommendations).toContainText("E2E JV Sophomore");
    await expect(recommendations).toContainText("E2E Starter Senior");
  });

  test("promoting a sophomore moves him to Varsity and it sticks", async ({
    page,
  }) => {
    if (!fixture || !seasonId) {
      test.skip();
      return;
    }

    await page.goto(`/dashboard/seasons/${seasonId}/offseason`);
    const board = page.getByTestId("roster-board");
    const row = board
      .getByTestId("roster-move-row")
      .filter({ hasText: "E2E JV Sophomore 1" });
    await expect(row).toBeVisible({ timeout: 30_000 });
    await expect(row.getByTestId("roster-move-squad")).toContainText("JV");

    await row.getByRole("button", { name: "Move up" }).click();
    await expect(row.getByTestId("roster-move-squad")).toContainText("Varsity", {
      timeout: 30_000,
    });

    // And it PERSISTS — the decision is a write, not local state.
    await page.reload();
    await expect(
      page
        .getByTestId("roster-board")
        .getByTestId("roster-move-row")
        .filter({ hasText: "E2E JV Sophomore 1" })
        .getByTestId("roster-move-squad"),
    ).toContainText("Varsity", { timeout: 30_000 });
  });

  test("a position change follows him onto the roster page", async ({
    page,
  }) => {
    if (!fixture || !seasonId) {
      test.skip();
      return;
    }

    await page.goto(`/dashboard/seasons/${seasonId}/offseason`);
    const row = page
      .getByTestId("roster-board")
      .getByTestId("roster-move-row")
      .filter({ hasText: "E2E JV Sophomore 2" });
    await expect(row).toBeVisible({ timeout: 30_000 });

    await row.getByRole("button", { name: "Change position" }).click();
    const options = row.getByTestId("position-change-options");
    await expect(options).toBeVisible();
    // Fit is shown per option — the whole question is "can he play there".
    await expect(options).toContainText("% fit");
    await options.getByRole("button", { name: "CB", exact: false }).click();

    await expect(row).toContainText("CB", { timeout: 30_000 });

    /*
     * Asserted on the OFFSEASON board after a reload rather than on the team
     * roster page: that page renders the ACTIVE season's assignments and this
     * change belongs to the upcoming one — the same trap B3 hit.
     */
    await page.reload();
    await expect(
      page
        .getByTestId("roster-board")
        .getByTestId("roster-move-row")
        .filter({ hasText: "E2E JV Sophomore 2" }),
    ).toContainText("CB", { timeout: 30_000 });
  });
});

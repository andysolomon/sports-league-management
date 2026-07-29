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
 * Offseason training (Dynasty Mode B6, #624).
 *
 * Its own fixture league, for the reason `offseason-phases.spec.ts` records:
 * the canonical shared league's season statuses churn between CI runs, and
 * everything here needs an UPCOMING season.
 *
 * The roster is seeded; every allocation and the application that follows go
 * through the real controls, the real actions and the real mutations. The last
 * test is the one that matters — training that never lands on a rating is a
 * budget meter, not a mechanic.
 */
test.describe("Training (B6)", () => {
  test.describe.configure({ mode: "serial" });

  const FIXTURE_KEY = "training";
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
      homeTeamName: "E2E TR Home",
      awayTeamName: "E2E TR Away",
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

  test("the panel prices each option in the ratings it would move", async ({
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
    await dialog.getByLabel("Season name").fill(`E2E Training ${Date.now()}`);
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
     * BOTH teams. The hub acts for the first team the viewer manages in
     * `getTeamsByLeague` order, which is not the fixture's home-first order —
     * B4's first CI run proved that the hard way.
     */
    await seedRosterMoveCandidates(seasonId as string, fixture.homeTeamId, 3);
    await seedRosterMoveCandidates(seasonId as string, fixture.awayTeamId, 3);

    await page.goto(`/dashboard/seasons/${seasonId}/offseason`);
    const panel = page.getByTestId("training-panel");
    await expect(panel).toBeVisible({ timeout: 30_000 });

    // A budget meter alone is a chore. The point is seeing what a point buys.
    await expect(panel.getByTestId("training-budget-meter")).toBeVisible();
    await expect(panel.getByTestId("training-preview").first()).toContainText(
      /\+\d/,
      { timeout: 30_000 },
    );
  });

  test("committing points spends the budget and it sticks", async ({
    page,
  }) => {
    if (!fixture || !seasonId) {
      test.skip();
      return;
    }

    await page.goto(`/dashboard/seasons/${seasonId}/offseason`);
    const panel = page.getByTestId("training-panel");
    await expect(panel).toBeVisible({ timeout: 30_000 });

    const remaining = panel.getByTestId("training-points-remaining");
    const before = await remaining.textContent();

    /*
     * Ten points rather than the default two. The yield is `sqrt(points)`, and
     * the next test asserts the OVR moved — two points buy three attribute
     * points across six ratings, which is half an overall and rounds either
     * way depending on the seed. Ten is unambiguous.
     */
    await panel.getByTestId("training-points").selectOption("10");

    const row = panel
      .getByTestId("training-row")
      .filter({ hasText: "E2E JV Sophomore 1" });
    await expect(row).toBeVisible({ timeout: 30_000 });
    await row.getByTestId("training-commit").click();
    await expect(remaining).not.toHaveText(before ?? "", { timeout: 30_000 });

    // Persisted, not local state — a coach's plan has to survive a reload.
    const after = await remaining.textContent();
    await page.reload();
    await expect(
      page.getByTestId("training-panel").getByTestId("training-points-remaining"),
    ).toHaveText(after ?? "", { timeout: 30_000 });
  });

  test("leaving the training phase lands the gain on the roster", async ({
    page,
  }) => {
    if (!fixture || !seasonId) {
      test.skip();
      return;
    }

    await page.goto(`/dashboard/seasons/${seasonId}/offseason`);
    await expect(page.getByTestId("training-panel")).toBeVisible({
      timeout: 30_000,
    });

    /*
     * The overall BEFORE, read off the roster board rather than computed —
     * the assertion is that the number a coach looks at moved, not that a
     * function returned what it returns.
     */
    const boardRow = page
      .getByTestId("roster-board")
      .getByTestId("roster-move-row")
      .filter({ hasText: "E2E JV Sophomore 1" });
    await expect(boardRow).toBeVisible({ timeout: 30_000 });
    const before = await boardRow.textContent();

    /*
     * Walk to `training` and then out of it. Every step is the real Advance
     * button, so the spec also proves the new phase sits in the machine where
     * the stepper and the gate both expect it.
     */
    const stepper = page.getByTestId("offseason-phase-stepper");
    for (let i = 0; i < 6; i++) {
      const phase = await stepper.getAttribute("data-phase");
      if (phase === "activate") break;
      await page.getByTestId("offseason-advance").click();
      await expect(page.getByTestId("offseason-phase-message")).toBeVisible({
        timeout: 30_000,
      });
      await page.reload();
      await expect(stepper).toBeVisible({ timeout: 30_000 });
    }
    await expect(stepper).toHaveAttribute("data-phase", "activate", {
      timeout: 30_000,
    });
    await expect(page.getByTestId("offseason-phase-training")).toHaveAttribute(
      "data-state",
      "complete",
    );

    const after = await page
      .getByTestId("roster-board")
      .getByTestId("roster-move-row")
      .filter({ hasText: "E2E JV Sophomore 1" })
      .textContent();
    expect(after).not.toBe(before);
  });
});

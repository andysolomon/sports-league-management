import { test, expect } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";
import {
  seedProspectClass,
  withScheduleFixture,
  type ScheduleFixtureResult,
} from "../helpers/seed-schedule";
import { getTestOrgId } from "../helpers/seed-roster";
import { acceptBrowserConfirms } from "../helpers/sim-league-setup";

/*
 * Incoming freshman class with scouting (Dynasty Mode B3, #621).
 *
 * Its own fixture league, for the reason `offseason-phases.spec.ts` records:
 * the canonical shared league's season statuses churn between CI runs, and
 * every assertion here depends on an UPCOMING season.
 *
 * The prospects are seeded rather than rolled over. Generating a real class
 * needs a completed season to roll over from, and simulating one to a champion
 * would make this the slowest spec in the suite while coupling it to A1–A6.
 */
test.describe("Recruiting class (B3)", () => {
  test.describe.configure({ mode: "serial" });

  const FIXTURE_KEY = "recruiting-class";
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
      homeTeamName: "E2E RC Home",
      awayTeamName: "E2E RC Away",
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

  test("shows prospects as ranges and never as an exact rating", async ({
    page,
  }) => {
    if (!fixture) {
      test.skip();
      return;
    }

    // A new season is upcoming, which is what the offseason hub requires.
    await page.goto("/dashboard/seasons");
    const card = page.locator('[data-slot="card"]', { hasText: LEAGUE_NAME });
    await card.getByRole("button", { name: "New season" }).click();

    const dialog = page.getByRole("dialog", { name: "New season" });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Season name").fill(`E2E Recruiting ${Date.now()}`);
    await dialog.getByTestId("create-season-submit").click();

    const success = page.getByRole("dialog", { name: "Season created" });
    await expect(success).toBeVisible({ timeout: 30_000 });
    const href = await success
      .getByTestId("create-season-generate-schedule")
      .getAttribute("href");
    seasonId = href?.split("/")[3] ?? null;
    expect(seasonId).toBeTruthy();
    await success.getByRole("button", { name: "Done" }).click();

    await seedProspectClass(seasonId as string, 4);

    await page.goto(`/dashboard/seasons/${seasonId}/offseason`);

    const panel = page.getByTestId("scouting-panel");
    await expect(panel).toBeVisible({ timeout: 30_000 });

    // Ranges, not numbers — the whole mechanic.
    const ranges = panel.getByTestId("prospect-range");
    await expect(ranges.first()).toBeVisible();
    expect(await ranges.count()).toBe(4);

    const firstRange = await ranges.first().innerText();
    expect(firstRange).toMatch(/\d+–\d+/);

    /*
     * No exact-overall readout anywhere on the board. Asserted on the panel's
     * text rather than on a locator, because the failure this guards against is
     * a NEW element appearing, which no existing locator would catch.
     */
    const panelText = await panel.innerText();
    expect(panelText).not.toMatch(/overall[:\s]*\d/i);

    await expect(page.getByTestId("scouting-points-remaining")).toContainText(
      "scouting points remaining",
    );
  });

  test("scouting narrows the range and spends from the budget", async ({
    page,
  }) => {
    if (!fixture || !seasonId) {
      test.skip();
      return;
    }

    await page.goto(`/dashboard/seasons/${seasonId}/offseason`);
    const panel = page.getByTestId("scouting-panel");
    await expect(panel).toBeVisible({ timeout: 30_000 });

    /*
     * Located by NAME, not by position. The board sorts by the top of each
     * range, and scouting moves that — a locator pinned to the first row would
     * be watching a different prospect by the time the range narrowed.
     */
    const name = await panel
      .getByTestId("prospect-row")
      .first()
      .locator("p")
      .first()
      .innerText();
    const row = panel.getByTestId("prospect-row").filter({ hasText: name });

    const rangeBefore = await row.getByTestId("prospect-range").innerText();
    const [lowBefore, highBefore] = rangeBefore
      .match(/(\d+)–(\d+)/)!
      .slice(1)
      .map(Number);
    const budgetBefore = await page
      .getByTestId("scouting-points-remaining")
      .innerText();

    // `Scout (5)` — the cost is on the button, so this is a substring match.
    await row.getByRole("button", { name: "Scout" }).click();

    await expect
      .poll(
        async () => {
          const text = await row.getByTestId("prospect-range").innerText();
          const match = text.match(/(\d+)–(\d+)/);
          return match ? Number(match[2]) - Number(match[1]) : null;
        },
        { timeout: 30_000 },
      )
      .toBeLessThan(highBefore - lowBefore);

    await expect(page.getByTestId("scouting-points-remaining")).not.toHaveText(
      budgetBefore,
    );
  });

  test("signing a prospect turns him into a rostered player", async ({
    page,
  }) => {
    if (!fixture || !seasonId) {
      test.skip();
      return;
    }

    await page.goto(`/dashboard/seasons/${seasonId}/offseason`);
    const panel = page.getByTestId("scouting-panel");
    await expect(panel).toBeVisible({ timeout: 30_000 });

    const unsigned = panel
      .getByTestId("prospect-row")
      .filter({ has: page.getByRole("button", { name: "Sign" }) })
      .first();
    const name = await unsigned.locator("p").first().innerText();
    const row = panel.getByTestId("prospect-row").filter({ hasText: name });
    await row.getByRole("button", { name: "Sign" }).click();

    // The board records the signing rather than offering him again.
    await expect(row).toContainText("Signed", { timeout: 30_000 });

    // And it PERSISTS — the signing is a write, not a local state change.
    await page.reload();
    const afterReload = page
      .getByTestId("scouting-panel")
      .getByTestId("prospect-row")
      .filter({ hasText: name });
    await expect(afterReload).toContainText("Signed", { timeout: 30_000 });

    /*
     * And a real player exists. The signing is only meaningful if it produced
     * one — a board that marked prospects signed without creating anybody
     * would satisfy every assertion above.
     *
     * Checked on Players Home rather than the team's roster page. That page
     * renders the ACTIVE season's `rosterAssignments`, and a recruit signs into
     * the UPCOMING one — which is correct behaviour, not a gap: next year's
     * class belongs on next year's roster. Players Home is league-scoped and
     * season-independent, so it answers the question actually being asked.
     *
     * The fixture league is created with two teams and no players, so the
     * signed prospect is the only name there.
     */
    await page.goto("/dashboard/players");
    await expect(page.getByText(name, { exact: true }).first()).toBeVisible({
      timeout: 30_000,
    });
  });
});

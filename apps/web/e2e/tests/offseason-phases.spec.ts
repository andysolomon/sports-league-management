import { test, expect } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";
import {
  withScheduleFixture,
  type ScheduleFixtureResult,
} from "../helpers/seed-schedule";
import { getTestOrgId } from "../helpers/seed-roster";
import { acceptBrowserConfirms } from "../helpers/sim-league-setup";

/*
 * Persisted offseason phase machine (Dynasty Mode B1, #618).
 *
 * Runs in its own fixture league. The canonical shared league's season
 * statuses churn across CI runs, and the whole point of this suite is that the
 * Offseason link appears for an UPCOMING season and not for an active one —
 * an assertion that is meaningless if another spec can flip the status.
 *
 * A newly created season is upcoming, which is a far cheaper way to get one
 * than simulating a full season to a champion and rolling over.
 */
test.describe("Offseason phase machine (B1)", () => {
  test.describe.configure({ mode: "serial" });

  const FIXTURE_KEY = "offseason-phases";
  const LEAGUE_NAME = `E2E:${FIXTURE_KEY}`;

  let fixture: ScheduleFixtureResult | null = null;
  let teardown: (() => Promise<void>) | null = null;

  test.beforeAll(async () => {
    const orgId = getTestOrgId();
    test.skip(!orgId, "E2E_CLERK_ORG_ID not set");
    const handle = await withScheduleFixture({
      fixtureKey: FIXTURE_KEY,
      clerkOrgId: orgId,
      homeTeamName: "E2E OP Home",
      awayTeamName: "E2E OP Away",
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

  test("an upcoming season exposes the Offseason hub and advances a phase", async ({
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
    const seasonName = `E2E Offseason ${Date.now()}`;
    await dialog.getByLabel("Season name").fill(seasonName);
    await dialog.getByTestId("create-season-submit").click();

    const success = page.getByRole("dialog", { name: "Season created" });
    await expect(success).toBeVisible({ timeout: 30_000 });

    // Take the new season's id off the schedule shortcut rather than hunting
    // for its row — the seasons list sorts by status and date, so a name match
    // there is order-dependent in a way this suite has no reason to depend on.
    const href = await success
      .getByTestId("create-season-generate-schedule")
      .getAttribute("href");
    const seasonId = href?.split("/")[3];
    expect(seasonId).toBeTruthy();
    await success.getByRole("button", { name: "Done" }).click();

    await page.goto(`/dashboard/seasons/${seasonId}`);

    /*
     * The sibling link is the flag-gated entry added to buildSeasonSiblingLinks.
     *
     * Scoped to the Resource Header rather than the page: accessible-name
     * matching is a SUBSTRING match, and this spec names its season "E2E
     * Offseason …", so a bare page-level "Offseason" also matches the "View E2E
     * Offseason …" link on the season card.
     */
    const offseasonLink = page
      .getByTestId("resource-header-season")
      .getByRole("link", { name: "Offseason" });
    await expect(offseasonLink).toBeVisible({ timeout: 30_000 });
    await offseasonLink.click();
    await expect(page).toHaveURL(/\/dashboard\/seasons\/[^/]+\/offseason$/);

    // A freshly opened offseason sits at `draft` with the rollover recorded.
    const stepper = page.getByTestId("offseason-phase-stepper");
    await expect(stepper).toHaveAttribute("data-phase", "draft");
    await expect(page.getByTestId("offseason-phase-rollover")).toHaveAttribute(
      "data-state",
      "complete",
    );

    await page.getByTestId("offseason-advance").click();
    await expect(page.getByTestId("offseason-phase-message")).toContainText(
      "Free agency",
      { timeout: 30_000 },
    );

    // The phase is PERSISTED, which is the whole slice — a reload has to keep it.
    await page.reload();
    await expect(page.getByTestId("offseason-phase-stepper")).toHaveAttribute(
      "data-phase",
      "free_agency",
    );
    await expect(page.getByTestId("offseason-phase-draft")).toHaveAttribute(
      "data-state",
      "complete",
    );
  });

  test("an active season has no Offseason link and no hub page", async ({
    page,
  }) => {
    const active = fixture;
    if (!active) {
      test.skip();
      return;
    }

    await page.goto(`/dashboard/seasons/${active.seasonId}`);
    // Scoped to the Resource Header for the same reason as the test above:
    // accessible-name matching is a case-insensitive SUBSTRING match, and this
    // fixture's league is called "E2E:offseason-phases".
    await expect(
      page
        .getByTestId("resource-header-season")
        .getByRole("link", { name: "Offseason" }),
    ).toHaveCount(0);

    /*
     * The route itself refuses too, not just the link — an offseason prepares a
     * season that has not started, and this one has.
     *
     * Asserted on what RENDERS, not on the HTTP status. `/dashboard/*` streams
     * its shell before a page's guard runs, so the response headers go out as
     * 200 even when the page then calls `notFound()` (WSM-000190) — the same
     * caveat `schedules-standings.spec.ts` records for its own 404 checks,
     * which target fully server-rendered `/leagues/*` routes instead.
     */
    await page.goto(`/dashboard/seasons/${active.seasonId}/offseason`);
    await expect(page.getByTestId("offseason-phase-stepper")).toHaveCount(0);
    await expect(page.getByTestId("offseason-advance")).toHaveCount(0);
  });
});

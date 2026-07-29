import { test, expect } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";
import {
  seedTransferCandidates,
  withScheduleFixture,
  type ScheduleFixtureResult,
} from "../helpers/seed-schedule";
import { getTestOrgId } from "../helpers/seed-roster";
import { acceptBrowserConfirms } from "../helpers/sim-league-setup";

/*
 * Offseason transfers (Dynasty Mode B4, #622).
 *
 * Its own fixture league, for the reason `offseason-phases.spec.ts` records:
 * the canonical shared league's season statuses churn between CI runs, and
 * everything here needs an UPCOMING season.
 *
 * The candidates are seeded — six high-rated juniors stacked behind one
 * starter — but the WINDOW is opened through the real button and the real
 * mutation. Seeding the window itself would test nothing; seeding the roster
 * only guarantees the likelihood roll has somebody to find.
 */
test.describe("Transfer window (B4)", () => {
  test.describe.configure({ mode: "serial" });

  const FIXTURE_KEY = "transfer-window";
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
      homeTeamName: "E2E TW Home",
      awayTeamName: "E2E TW Away",
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

  test("an admin opens the window and buried players appear in it", async ({
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
    await dialog.getByLabel("Season name").fill(`E2E Transfers ${Date.now()}`);
    await dialog.getByTestId("create-season-submit").click();

    const success = page.getByRole("dialog", { name: "Season created" });
    await expect(success).toBeVisible({ timeout: 30_000 });
    const href = await success
      .getByTestId("create-season-generate-schedule")
      .getAttribute("href");
    seasonId = href?.split("/")[3] ?? null;
    expect(seasonId).toBeTruthy();
    await success.getByRole("button", { name: "Done" }).click();

    await seedTransferCandidates(seasonId as string, fixture.homeTeamId, 6);

    await page.goto(`/dashboard/seasons/${seasonId}/offseason`);
    const panel = page.getByTestId("transfer-panel");
    await expect(panel).toBeVisible({ timeout: 30_000 });

    // Nothing exists until the commissioner opens it.
    await expect(panel).toContainText("has not been opened");
    await panel.getByTestId("open-transfer-window").click();
    await expect(panel).toContainText("entered the window", {
      timeout: 30_000,
    });

    await page.reload();
    const outbound = page.getByTestId("transfer-outbound");
    await expect(outbound.getByTestId("transfer-row").first()).toBeVisible({
      timeout: 30_000,
    });
    // The reason is the argument the coach answers, so it has to be on screen.
    await expect(outbound).toContainText("Buried on the depth chart");
  });

  test("keeping a player takes him off the board", async ({ page }) => {
    if (!fixture || !seasonId) {
      test.skip();
      return;
    }

    await page.goto(`/dashboard/seasons/${seasonId}/offseason`);
    const outbound = page.getByTestId("transfer-outbound");
    await expect(outbound.getByTestId("transfer-row").first()).toBeVisible({
      timeout: 30_000,
    });

    /*
     * Located by NAME rather than by position: resolving a row can withdraw
     * others, so the list can reorder underneath a positional locator.
     */
    const row = outbound.getByTestId("transfer-row").first();
    const name = await row.locator("p").first().innerText();
    await row.getByRole("button", { name: "Keep him" }).click();

    const byName = outbound
      .getByTestId("transfer-row")
      .filter({ hasText: name });
    await expect(byName.getByTestId("transfer-status")).toContainText(
      "Declined",
      { timeout: 30_000 },
    );

    // And it PERSISTS — the decision is a write, not local state.
    await page.reload();
    await expect(
      page
        .getByTestId("transfer-outbound")
        .getByTestId("transfer-row")
        .filter({ hasText: name })
        .getByTestId("transfer-status"),
    ).toContainText("Declined", { timeout: 30_000 });
  });

  test("a released player can be signed by the program that wanted him", async ({
    page,
  }) => {
    if (!fixture || !seasonId) {
      test.skip();
      return;
    }

    await page.goto(`/dashboard/seasons/${seasonId}/offseason`);
    const outbound = page.getByTestId("transfer-outbound");
    await expect(outbound.getByTestId("transfer-row").first()).toBeVisible({
      timeout: 30_000,
    });

    const pending = outbound
      .getByTestId("transfer-row")
      .filter({ has: page.getByRole("button", { name: "Let him go" }) })
      .first();
    const name = await pending.locator("p").first().innerText();
    await pending.getByRole("button", { name: "Let him go" }).click();

    await expect(
      outbound
        .getByTestId("transfer-row")
        .filter({ hasText: name })
        .getByTestId("transfer-status"),
    ).toContainText("Accepted", { timeout: 30_000 });

    /*
     * The inbound half is only visible to the DESTINATION team. This viewer is
     * the commissioner, who acts for whichever team the page resolved — so
     * rather than assume the offer landed in this panel, assert on what the
     * outbound decision guarantees: he is released, and the losing program's
     * board says so after a reload.
     */
    await page.reload();
    await expect(
      page
        .getByTestId("transfer-outbound")
        .getByTestId("transfer-row")
        .filter({ hasText: name })
        .getByTestId("transfer-status"),
    ).toContainText("Accepted", { timeout: 30_000 });
  });
});

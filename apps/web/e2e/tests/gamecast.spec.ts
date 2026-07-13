import { test, expect } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";
import path from "node:path";
import {
  withScheduleFixture,
  type ScheduleFixtureResult,
} from "../helpers/seed-schedule";
import { getTestOrgId } from "../helpers/seed-roster";
import {
  acceptBrowserConfirms,
  bootstrapFourTeamSimLeague,
} from "../helpers/sim-league-setup";

/*
 * Gamecast stepping (Slice C) — simmed fixtures expose play-by-play replay;
 * manually recorded finals show the friendly empty state.
 */
const FIXTURE_KEY = "gamecast";
const LEAGUE_NAME = `E2E:${FIXTURE_KEY}`;
const STORAGE_STATE = path.resolve("e2e", ".auth", "user.json");

type SimmedGamecastContext = {
  expectedHome: number;
  expectedAway: number;
  homeName: string;
  awayName: string;
};

async function readPlayCounter(
  page: import("@playwright/test").Page,
): Promise<{ index: number; total: number }> {
  const text = await page.getByText(/^Play \d+\/\d+/).innerText();
  const match = text.match(/Play (\d+)\/(\d+)/);
  expect(match).not.toBeNull();
  return { index: Number(match![1]), total: Number(match![2]) };
}

function playByPlayRows(page: import("@playwright/test").Page) {
  return page
    .locator('[data-slot="card"]', {
      has: page.getByText("Play-by-play", { exact: true }),
    })
    .locator("ul button");
}

/*
 * WSM-000239: the schedule is a lifecycle accordion — completed weeks start
 * collapsed (rows unmounted) and a mixed week's finished games sit inside a
 * nested, collapsed "Completed" disclosure. Expand every week, then open any
 * collapsed disclosures, so rows can be found by content instead of position.
 */
async function revealAllScheduleRows(
  page: import("@playwright/test").Page,
): Promise<void> {
  const expandAll = page.getByRole("button", { name: "Expand all" });
  if (await expandAll.isVisible().catch(() => false)) {
    await expandAll.click();
  }
  const toggles = page.getByRole("button", { name: /^Completed games — / });
  const count = await toggles.count();
  for (let i = 0; i < count; i++) {
    const toggle = toggles.nth(i);
    if ((await toggle.getAttribute("aria-expanded")) === "false") {
      await toggle.click();
    }
  }
}

async function openSimmedGamecastFinal(
  page: import("@playwright/test").Page,
  leagueId: string,
): Promise<SimmedGamecastContext> {
  await page.goto(`/dashboard/leagues/${leagueId}/schedule`);
  await expect(
    page.getByRole("heading", { name: LEAGUE_NAME }),
  ).toBeVisible();

  await revealAllScheduleRows(page);

  // Reuse a previously simmed final: only simmed finals carry a Gamecast
  // link (manually recorded finals don't).
  let simRow = page
    .locator("tbody tr")
    .filter({ has: page.getByRole("link", { name: "Gamecast" }) })
    .first();

  if ((await simRow.count()) === 0) {
    const scheduledRow = page
      .locator("tbody tr")
      .filter({ has: page.getByText("Scheduled", { exact: true }) })
      .first();
    const homeName = await scheduledRow.locator("td").nth(1).innerText();
    const awayName = await scheduledRow.locator("td").nth(2).innerText();
    const simTestId = await scheduledRow.getAttribute("data-testid");
    expect(simTestId).toMatch(/^schedule-fixture-/);

    await page
      .getByRole("button", {
        name: `Simulate ${homeName} vs ${awayName}`,
      })
      .click();
    // The refresh moves the freshly-final game into its week's (new,
    // collapsed) Completed disclosure — reveal again and re-find by testid.
    simRow = page.getByTestId(simTestId!);
    await expect(async () => {
      await revealAllScheduleRows(page);
      await expect(simRow.getByText("Final", { exact: true })).toBeVisible();
    }).toPass({ timeout: 60_000 });
  }

  const homeName = await simRow.locator("td").nth(1).innerText();
  const awayName = await simRow.locator("td").nth(2).innerText();

  const scoreText = (await simRow.locator("td").nth(3).innerText()).trim();
  const scoreMatch = scoreText.match(/(\d+)\s*[–-]\s*(\d+)/);
  expect(scoreMatch).not.toBeNull();
  const expectedHome = Number(scoreMatch![1]);
  const expectedAway = Number(scoreMatch![2]);

  await simRow.getByRole("link", { name: "Gamecast" }).click();
  await expect(page).toHaveURL(/\/dashboard\/games\/[^/]+\/gamecast$/);
  await expect(
    page.getByRole("heading", { name: "Gamecast" }),
  ).toBeVisible();

  return { expectedHome, expectedAway, homeName, awayName };
}

async function assertFinalReviewState(
  page: import("@playwright/test").Page,
  ctx: SimmedGamecastContext,
) {
  await expect(page.getByText("Final", { exact: true }).first()).toBeVisible();
  await expect(page.getByTestId("gamecast-score-home")).toContainText(
    String(ctx.expectedHome),
  );
  await expect(page.getByTestId("gamecast-score-away")).toContainText(
    String(ctx.expectedAway),
  );
  await expect(playByPlayRows(page)).not.toHaveCount(0);

  const { index, total } = await readPlayCounter(page);
  expect(index).toBe(total);
  expect(total).toBeGreaterThan(0);

  const scrubber = page.getByLabel("Scrub play index");
  await expect(scrubber).toBeVisible();
  await expect(scrubber).toHaveValue(String(total));
}

test.describe("Gamecast replay (WSM gamecast)", () => {
  let fixture: ScheduleFixtureResult | null = null;
  let teardown: (() => Promise<void>) | null = null;

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(300_000);
    const orgId = getTestOrgId();
    test.skip(!orgId, "E2E_CLERK_ORG_ID not set");
    const handle = await withScheduleFixture({
      fixtureKey: FIXTURE_KEY,
      clerkOrgId: orgId,
      homeTeamName: "E2E GC Home",
      awayTeamName: "E2E GC Away",
    });
    fixture = handle.fixture;
    teardown = handle.teardown;

    const context = await browser.newContext({ storageState: STORAGE_STATE });
    const page = await context.newPage();
    await setupClerkTestingToken({ page });
    acceptBrowserConfirms(page);
    await bootstrapFourTeamSimLeague(page, fixture.leagueId, LEAGUE_NAME);
    await context.close();
  });

  test.afterAll(async () => {
    if (teardown) await teardown();
  });

  test.beforeEach(async ({ page }) => {
    test.setTimeout(180_000);
    await setupClerkTestingToken({ page });
    acceptBrowserConfirms(page);
  });

  test("simmed fixture gamecast stepping and manual-final empty state", async ({
    page,
  }) => {
    if (!fixture) test.skip();
    const leagueId = fixture!.leagueId;

    await page.goto(`/dashboard/leagues/${leagueId}/schedule`);
    await expect(
      page.getByRole("heading", { name: LEAGUE_NAME }),
    ).toBeVisible();

    await revealAllScheduleRows(page);
    const scheduledRow = page
      .locator("tbody tr")
      .filter({ has: page.getByText("Scheduled", { exact: true }) })
      .first();
    const homeName = await scheduledRow.locator("td").nth(1).innerText();
    const awayName = await scheduledRow.locator("td").nth(2).innerText();
    const simFixtureId = await scheduledRow.getAttribute("data-testid");
    expect(simFixtureId).toMatch(/^schedule-fixture-/);

    await page
      .getByRole("button", {
        name: `Simulate ${homeName} vs ${awayName}`,
      })
      .click();
    // WSM-000239: the freshly-final game lands in its week's collapsed
    // "Completed" disclosure — reveal, then re-find the row by its testid.
    const simRow = page.getByTestId(simFixtureId!);
    await expect(async () => {
      await revealAllScheduleRows(page);
      await expect(simRow.getByText("Final", { exact: true })).toBeVisible();
    }).toPass({ timeout: 60_000 });

    const scoreText = (await simRow.locator("td").nth(3).innerText()).trim();
    const scoreMatch = scoreText.match(/(\d+)\s*[–-]\s*(\d+)/);
    expect(scoreMatch).not.toBeNull();
    const expectedHome = Number(scoreMatch![1]);
    const expectedAway = Number(scoreMatch![2]);

    await simRow.getByRole("link", { name: "Gamecast" }).click();
    await expect(page).toHaveURL(/\/dashboard\/games\/[^/]+\/gamecast$/);
    await expect(
      page.getByRole("heading", { name: "Gamecast" }),
    ).toBeVisible();
    await expect(page.getByText(homeName).first()).toBeVisible();
    await expect(page.getByText(awayName).first()).toBeVisible();
    await expect(page.locator('[aria-label="Drive chart"]')).toBeVisible();

    await expect(
      page.getByText("Final", { exact: true }).first(),
    ).toBeVisible();
    await expect(page.getByTestId("gamecast-score-home")).toContainText(
      String(expectedHome),
    );
    await expect(page.getByTestId("gamecast-score-away")).toContainText(
      String(expectedAway),
    );

    await page.getByRole("button", { name: "Restart" }).click();
    await page.getByRole("button", { name: "Sim", exact: true }).click();
    await expect(
      page.getByText("Press Next play to start the gamecast."),
    ).toBeVisible();

    const playRows = () =>
      page
        .locator('[data-slot="card"]', {
          has: page.getByText("Play-by-play", { exact: true }),
        })
        .locator("ul button");

    await page.getByRole("button", { name: "Next play" }).click();
    await expect(playRows()).not.toHaveCount(0);
    const afterOnePlay = await playRows().count();

    await page.getByRole("button", { name: "Next play" }).click();
    await expect(playRows()).toHaveCount(afterOnePlay + 1);

    await page.getByRole("button", { name: "Next quarter" }).click();
    expect(await playRows().count()).toBeGreaterThan(afterOnePlay);

    await page.getByRole("button", { name: "Entire game" }).click();
    await expect(
      page.getByText("Final", { exact: true }).first(),
    ).toBeVisible();
    await expect(page.getByTestId("gamecast-score-home")).toContainText(
      String(expectedHome),
    );
    await expect(page.getByTestId("gamecast-score-away")).toContainText(
      String(expectedAway),
    );
    await expect(page.getByText(/drive/i).first()).toBeVisible();

    await page.getByRole("button", { name: "Restart" }).click();
    await page.getByRole("button", { name: "Sim", exact: true }).click();
    await expect(
      page.getByText("Press Next play to start the gamecast."),
    ).toBeVisible();

    // Return to the schedule to exercise the manual-record → empty-state path.
    await page.goto(`/dashboard/leagues/${leagueId}/schedule`);
    await expect(
      page.getByRole("heading", { name: LEAGUE_NAME }),
    ).toBeVisible();

    const manualRow = page
      .locator("tbody tr")
      .filter({ has: page.getByText("Scheduled", { exact: true }) })
      .first();
    await expect(manualRow).toBeVisible();
    const manualHome = await manualRow.locator("td").nth(1).innerText();
    const manualAway = await manualRow.locator("td").nth(2).innerText();
    const manualTestId = await manualRow.getAttribute("data-testid");
    expect(manualTestId).toMatch(/^schedule-fixture-/);
    const manualFixtureId = manualTestId!.replace("schedule-fixture-", "");

    await manualRow.getByRole("button", { name: "Record result" }).click();
    const resultDialog = page.getByRole("dialog");
    await resultDialog.getByLabel(new RegExp(manualHome)).fill("14");
    await resultDialog.getByLabel(new RegExp(manualAway)).fill("7");
    await resultDialog.getByRole("button", { name: "Save result" }).click();
    await expect(resultDialog).toBeHidden();
    // Re-select by stable testid: the Scheduled-filtered `manualRow` stops
    // matching once the result is recorded and the row flips to Final.
    const recordedRow = page.getByTestId(`schedule-fixture-${manualFixtureId}`);
    await expect(recordedRow.getByText("Final", { exact: true })).toBeVisible();
    await expect(
      recordedRow.getByRole("link", { name: "Gamecast" }),
    ).toHaveCount(0);

    await page.goto(`/dashboard/games/${manualFixtureId}/gamecast`);
    await expect(
      page.getByText(
        "Gamecast is available for simulated games with a stored play-by-play log.",
      ),
    ).toBeVisible();
  });

  test("opens on final in review with populated play-by-play and scrubber at max", async ({
    page,
  }) => {
    if (!fixture) test.skip();
    const ctx = await openSimmedGamecastFinal(page, fixture!.leagueId);
    await assertFinalReviewState(page, ctx);
    await expect(
      page.getByRole("button", { name: "Review", pressed: true }),
    ).toBeVisible();
  });

  test("transport navigation from final moves play counter and disables at boundaries", async ({
    page,
  }) => {
    if (!fixture) test.skip();
    const ctx = await openSimmedGamecastFinal(page, fixture!.leagueId);
    await assertFinalReviewState(page, ctx);

    const { total } = await readPlayCounter(page);

    await page.getByRole("button", { name: "Previous play" }).click();
    await expect(page.getByText(/^Play \d+\/\d+/)).toContainText(
      `Play ${total - 1}/${total}`,
    );

    const beforeQuarter = await readPlayCounter(page);
    await page.getByRole("button", { name: "Previous quarter" }).click();
    const afterQuarter = await readPlayCounter(page);
    expect(afterQuarter.index).toBeLessThan(beforeQuarter.index);

    const beforeHalf = await readPlayCounter(page);
    await page.getByRole("button", { name: "Previous half" }).click();
    const afterHalf = await readPlayCounter(page);
    expect(afterHalf.index).toBeLessThan(beforeHalf.index);

    await page.getByRole("button", { name: "Restart" }).click();
    await expect(page.getByText(/^Play 0\//)).toBeVisible();

    await expect(
      page.getByRole("button", { name: "Restart" }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Previous half" }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Previous quarter" }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Previous play" }),
    ).toBeDisabled();

    await page.getByRole("button", { name: "Next play" }).click();
    await expect(page.getByText(/^Play 1\//)).toBeVisible();

    await page.getByRole("button", { name: "Entire game" }).click();
    await expect(page.getByText(`Play ${total}/${total}`)).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Next play" }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Next quarter" }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Next half" }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Entire game" }),
    ).toBeDisabled();
    await expect(page.getByTestId("gamecast-score-home")).toContainText(
      String(ctx.expectedHome),
    );
  });

  test("review scrubber updates score and play counter at mid-game position", async ({
    page,
  }) => {
    if (!fixture) test.skip();
    const ctx = await openSimmedGamecastFinal(page, fixture!.leagueId);
    await assertFinalReviewState(page, ctx);

    const { total } = await readPlayCounter(page);
    const mid = Math.max(1, Math.floor(total / 2));
    const scrubber = page.getByLabel("Scrub play index");
    await scrubber.fill(String(mid));
    await scrubber.dispatchEvent("change");

    await expect(page.getByText(`Play ${mid}/${total}`)).toBeVisible();

    const homeScore = Number(
      (await page.getByTestId("gamecast-score-home").innerText()).trim(),
    );
    const awayScore = Number(
      (await page.getByTestId("gamecast-score-away").innerText()).trim(),
    );
    expect(homeScore).toBeLessThanOrEqual(ctx.expectedHome);
    expect(awayScore).toBeLessThanOrEqual(ctx.expectedAway);
    if (mid < total) {
      expect(homeScore + awayScore).toBeLessThanOrEqual(
        ctx.expectedHome + ctx.expectedAway,
      );
    }

    await expect(
      page
        .locator('[data-slot="card"]', {
          has: page.getByText("Play-by-play", { exact: true }),
        })
        .locator("ul button.border-l-2"),
    ).toHaveCount(1);
  });

  test("mode switch hides future plays in sim and restores review scrubber", async ({
    page,
  }) => {
    if (!fixture) test.skip();
    await openSimmedGamecastFinal(page, fixture!.leagueId);

    const { total } = await readPlayCounter(page);
    const mid = Math.max(2, Math.floor(total / 2));
    const scrubber = page.getByLabel("Scrub play index");
    await scrubber.fill(String(mid));
    await scrubber.dispatchEvent("change");
    await expect(page.getByText(`Play ${mid}/${total}`)).toBeVisible();

    const reviewRowCount = await playByPlayRows(page).count();
    expect(reviewRowCount).toBe(total);
    await expect(
      page
        .locator('[data-slot="card"]', {
          has: page.getByText("Play-by-play", { exact: true }),
        })
        .locator("ul button.opacity-40"),
    ).not.toHaveCount(0);

    await page.getByRole("button", { name: "Sim", exact: true }).click();
    await expect(page.getByLabel("Scrub play index")).toHaveCount(0);
    await expect(page.getByLabel("Simulation progress")).toBeVisible();

    const simRowCount = await playByPlayRows(page).count();
    expect(simRowCount).toBe(mid);
    expect(simRowCount).toBeLessThan(reviewRowCount);

    await page.getByRole("button", { name: "Review" }).click();
    await expect(page.getByLabel("Scrub play index")).toBeVisible();
    await expect(playByPlayRows(page)).toHaveCount(total);
    await expect(
      page
        .locator('[data-slot="card"]', {
          has: page.getByText("Play-by-play", { exact: true }),
        })
        .locator("ul button.opacity-40"),
    ).not.toHaveCount(0);
  });

  test("auto-sim play advances counter, pause holds steady, and 4x reaches final", async ({
    page,
  }) => {
    if (!fixture) test.skip();
    await openSimmedGamecastFinal(page, fixture!.leagueId);

    await page.getByRole("button", { name: "Restart" }).click();
    await page.getByRole("button", { name: "Sim", exact: true }).click();
    await expect(page.getByText(/^Play 0\//)).toBeVisible();

    const startCounter = await readPlayCounter(page);
    const y0 = await page.evaluate(() => window.scrollY);
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect
      .poll(async () => (await readPlayCounter(page)).index, {
        timeout: 30_000,
      })
      .toBeGreaterThan(startCounter.index + 2);
    expect(await page.evaluate(() => window.scrollY)).toBe(y0);

    await page.getByRole("button", { name: "Pause" }).click();
    const pausedIndex = (await readPlayCounter(page)).index;
    await expect
      .poll(async () => (await readPlayCounter(page)).index, {
        timeout: 5_000,
      })
      .toBe(pausedIndex);

    await page.getByRole("button", { name: "Restart" }).click();
    await page.getByRole("button", { name: "Sim", exact: true }).click();
    await page
      .getByRole("group", { name: "Simulation speed" })
      .getByRole("button", { name: "4×" })
      .click();
    await page.getByRole("button", { name: "Play", exact: true }).click();

    const { total } = await readPlayCounter(page);
    await expect
      .poll(async () => (await readPlayCounter(page)).index, {
        timeout: 120_000,
      })
      .toBe(total);
    await expect(page.getByText("Final", { exact: true }).first()).toBeVisible();
    await expect(page.getByText(`Play ${total}/${total}`)).toBeVisible();
  });

  test("layout switcher shows field-first and operator layouts and persists choice", async ({
    page,
  }) => {
    if (!fixture) test.skip();
    const ctx = await openSimmedGamecastFinal(page, fixture!.leagueId);
    await assertFinalReviewState(page, ctx);

    await page.getByTestId("gamecast-layout-field-first").click();
    await expect(page.getByTestId("gamecast-field-first-layout")).toBeVisible();
    await expect(page.getByTestId("gamecast-score-home")).toContainText(
      String(ctx.expectedHome),
    );
    await expect(page.getByTestId("gamecast-score-away")).toContainText(
      String(ctx.expectedAway),
    );

    await page.getByTestId("gamecast-layout-operator").click();
    const operatorHeader = page.getByTestId("gamecast-operator-header");
    await expect(operatorHeader).toBeVisible();
    await expect(page.getByTestId("gamecast-operator-clock-chip")).toContainText(
      "Final",
    );
    // The operator layout renders the score inline in its mono header rather
    // than the broadcast scoreboard's gamecast-score-home/away testids.
    await expect(operatorHeader).toContainText(String(ctx.expectedHome));
    await expect(operatorHeader).toContainText(String(ctx.expectedAway));

    await page.reload();
    // The operator layout content is the deterministic post-hydration signal
    // that the persisted choice was restored; wait for it before asserting the
    // switcher button's aria state (which otherwise races client hydration).
    await expect(page.getByTestId("gamecast-operator-header")).toBeVisible();
    await expect(
      page.getByTestId("gamecast-layout-operator"),
    ).toHaveAttribute("aria-pressed", "true");

    await page.getByTestId("gamecast-layout-broadcast").click();
    await expect(
      page.getByTestId("gamecast-layout-broadcast"),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("gamecast-field-first-layout")).toHaveCount(
      0,
    );
  });

  test("scheduled schedule row opens preview drawer with team context", async ({
    page,
  }) => {
    if (!fixture) test.skip();
    const leagueId = fixture!.leagueId;

    await page.goto(`/dashboard/leagues/${leagueId}/schedule`);
    await revealAllScheduleRows(page);

    const scheduledRow = page
      .locator("tbody tr")
      .filter({ has: page.getByText("Scheduled", { exact: true }) })
      .first();
    const homeName = await scheduledRow.locator("td").nth(1).innerText();
    const awayName = await scheduledRow.locator("td").nth(2).innerText();

    await scheduledRow
      .getByRole("button", {
        name: new RegExp(`View preview for ${homeName} vs ${awayName}`),
      })
      .first()
      .click();

    const drawer = page.getByTestId("game-context-drawer");
    await expect(drawer).toBeVisible();
    await expect(drawer.getByTestId("game-drawer-mode")).toHaveText(/^Preview/);
    await expect(
      drawer.getByRole("heading", { name: `${homeName} vs ${awayName}` }),
    ).toBeVisible();
    await expect(drawer.getByTestId("game-drawer-open-gamecast")).toHaveCount(0);

    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();

    await expect
      .poll(() => scheduledRow.getByRole("button").first().evaluate((el) => el === document.activeElement))
      .toBe(true);
  });

  test("final schedule row opens summary drawer and links to full Gamecast", async ({
    page,
  }) => {
    if (!fixture) test.skip();
    const ctx = await openSimmedGamecastFinal(page, fixture!.leagueId);

    await page.goto(`/dashboard/leagues/${fixture!.leagueId}/schedule`);
    await revealAllScheduleRows(page);

    const finalRow = page.getByTestId(/^schedule-fixture-/).filter({
      has: page.getByText("Final", { exact: true }),
    }).first();
    await finalRow
      .getByRole("button", {
        name: new RegExp(
          `View final for ${ctx.homeName} vs ${ctx.awayName}`,
        ),
      })
      .first()
      .click();

    const drawer = page.getByTestId("game-context-drawer");
    await expect(drawer).toBeVisible();
    await expect(drawer.getByTestId("game-drawer-mode")).toHaveText(/^Final/);
    // Use side-specific score testids — tied finals (e.g. 17–17) make getByText(score) ambiguous.
    await expect(drawer.getByTestId("game-drawer-home-score")).toHaveText(
      String(ctx.expectedHome),
    );
    await expect(drawer.getByTestId("game-drawer-away-score")).toHaveText(
      String(ctx.expectedAway),
    );

    await drawer.getByTestId("game-drawer-open-gamecast").click();
    await expect(page).toHaveURL(/\/dashboard\/games\/[^/]+\/gamecast$/);
    await expect(
      page.getByRole("heading", { name: "Gamecast" }),
    ).toBeVisible();
  });

  test("drawer on schedule does not overflow a 375px viewport", async ({
    page,
  }) => {
    if (!fixture) test.skip();
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`/dashboard/leagues/${fixture!.leagueId}/schedule`);
    await revealAllScheduleRows(page);

    const pageOverflow = () =>
      page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));

    const before = await pageOverflow();

    const row = page.locator("tbody tr").first();
    await row.getByRole("button").first().click();
    const drawer = page.getByTestId("game-context-drawer");
    await expect(drawer).toBeVisible();

    const after = await pageOverflow();
    const beforeDelta = before.scrollWidth - before.clientWidth;
    const afterDelta = after.scrollWidth - after.clientWidth;
    // Opening the drawer must not widen the page beyond subpixel slack.
    expect(afterDelta).toBeLessThanOrEqual(beforeDelta + 1);

    const drawerBox = await drawer.boundingBox();
    expect(drawerBox).not.toBeNull();
    expect(drawerBox!.x).toBeGreaterThanOrEqual(0);
    expect(drawerBox!.x + drawerBox!.width).toBeLessThanOrEqual(
      after.clientWidth + 1,
    );
  });
});

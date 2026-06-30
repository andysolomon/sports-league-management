import { test, expect, type Page } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";
import {
  withRosterFixture,
  getTestOrgId,
  type RosterFixtureResult,
} from "../helpers/seed-roster";

// WSM-000085: no dashboard page may scroll horizontally on a phone.
// Wide tables must scroll inside their own container (overflow-x-auto),
// which only works while every flex ancestor can shrink (min-w-0).
const PHONE = { width: 375, height: 812 };

async function expectNoPageOverflow(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  // 1px slack for subpixel rounding.
  expect(
    scrollWidth,
    `${path} scrolls horizontally (${scrollWidth}px content in ${clientWidth}px viewport)`,
  ).toBeLessThanOrEqual(clientWidth + 1);
}

test.describe.serial("Mobile — no horizontal page overflow (WSM-000085)", () => {
  let fixture: RosterFixtureResult | null = null;
  let teardown: (() => Promise<void>) | null = null;

  test.beforeAll(async () => {
    const orgId = getTestOrgId();
    test.skip(!orgId, "E2E_CLERK_ORG_ID not set");
    const handle = await withRosterFixture({
      fixtureKey: "mobile-overflow",
      clerkOrgId: orgId,
      teamName: "E2E Mobile Overflow Team",
      rosterLimit: 53,
      seedActivePlayers: 12,
      extraBenchPlayers: 0,
      positionSlot: "QB",
    });
    fixture = handle.fixture;
    teardown = handle.teardown;
  });

  test.afterAll(async () => {
    if (teardown) await teardown();
  });

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(PHONE);
    await setupClerkTestingToken({ page });
  });

  test("dashboard overview fits the viewport", async ({ page }) => {
    await expectNoPageOverflow(page, "/dashboard");
  });

  test("teams list fits the viewport", async ({ page }) => {
    await expectNoPageOverflow(page, "/dashboard/teams");
  });

  test("players list fits the viewport", async ({ page }) => {
    await expectNoPageOverflow(page, "/dashboard/players");
  });

  // Was the real responsive bug (#419): the roster header (h3 + up to four
  // action buttons) sat in a no-wrap flex row that pushed the page to ~626px on
  // a 375px viewport. Fixed by letting that row wrap (team-management.tsx).
  test("team page with a seeded roster table fits the viewport", async ({
    page,
  }) => {
    await expectNoPageOverflow(page, `/dashboard/teams/${fixture!.teamId}`);
  });

  test("leagues page fits the viewport", async ({ page }) => {
    await expectNoPageOverflow(page, "/dashboard/leagues");
  });
});

import { test, expect, type Page } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";
import { readCanonicalFixture, setActiveLeague } from "../helpers/seed-canonical";
import { TEAMS } from "../helpers/test-data";
import {
  withRosterFixture,
  getTestOrgId,
  getTestOrgIdB,
  type RosterFixtureResult,
} from "../helpers/seed-roster";

// Was quarantined via #419/#435: the route 404'd for EVERY team — the page
// passed an empty visibleLeagueIds to getTeam, whose access check then always
// threw, and the .catch() collapsed that into notFound(). Fixed by resolving
// the team's leagueId first (page.tsx), the same pattern as roster/audit.
test.describe("Depth Chart (WSM-000007)", () => {
  test.beforeEach(async ({ page }) => {
    await setupClerkTestingToken({ page });
    await setActiveLeague(page, readCanonicalFixture().leagueId);
  });

  test("flag-gated route is reachable in dev (flag default: on)", async ({
    page,
  }) => {
    await page.goto("/dashboard/teams");
    const teamLink = page.locator("a", { hasText: TEAMS.COWBOYS.name });
    await teamLink.waitFor({ state: "visible" });
    const href = await teamLink.getAttribute("href");
    expect(href).toBeTruthy();
    await page.goto(`${href}/depth-chart`);
    // Assert the board actually rendered — checking for the ABSENCE of a 404
    // heading is too weak (Next's not-found heading, "This page could not be
    // found.", didn't even match the old regex, so a 404 could slip through).
    await expect(
      page.getByRole("heading", {
        name: `${TEAMS.COWBOYS.name} — Depth Chart`,
      }),
    ).toBeVisible();
  });
});

// WSM-000085: on a phone the depth-chart board must be usable by touch — the
// drag handles need to render and meet the 44px minimum touch target. The
// reorder gesture itself is a 200ms press-and-hold (TouchSensor); we assert
// the handles are present and tappable rather than simulating the hold, which
// is brittle across engines.
const PHONE = { width: 375, height: 812 };

test.describe("Depth Chart — mobile touch targets (WSM-000085)", () => {
  let fixture: RosterFixtureResult | null = null;
  let teardown: (() => Promise<void>) | null = null;

  test.beforeAll(async () => {
    const orgId = getTestOrgId();
    test.skip(!orgId, "E2E_CLERK_ORG_ID not set");
    const handle = await withRosterFixture({
      fixtureKey: "depth-chart-mobile",
      clerkOrgId: orgId,
      teamName: "E2E Depth Chart Mobile Team",
      rosterLimit: 53,
      seedActivePlayers: 3,
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

  // The "selector rot" suspected in #419 was a misdiagnosis: the handle is
  // still <button aria-label="Drag {name}">. The handles never rendered
  // because the route itself 404'd (see the fix note at the top of this file).
  test("drag handles render and meet the 44px touch target", async ({
    page,
  }) => {
    await page.goto(`/dashboard/teams/${fixture!.teamId}/depth-chart`);
    await page.waitForLoadState("networkidle");

    const handles = page.getByRole("button", { name: /^Drag / });
    await expect(handles.first()).toBeVisible();
    expect(await handles.count()).toBeGreaterThanOrEqual(3);

    // Every handle must be at least 44px in both dimensions.
    const count = await handles.count();
    for (let i = 0; i < count; i++) {
      const box = await handles.nth(i).boundingBox();
      expect(box).not.toBeNull();
      expect(box!.height).toBeGreaterThanOrEqual(44);
      expect(box!.width).toBeGreaterThanOrEqual(44);
    }
  });
});

// Seeded depth-chart scenarios (WSM-000197, un-quarantines the #419 fixmes).
// The roster fixture now also seeds depthChartEntries (sortOrder = seed index)
// so the QB column renders a deterministic initial order to reorder against.
// All three describes run against the shared signed-in storageState (user A,
// admin of E2E_CLERK_ORG_ID) — same auth model as the mobile describe above.

/** The ordered player rows inside one position column. */
function columnRows(page: Page, positionSlot: string) {
  return page
    .getByRole("region", { name: `${positionSlot} depth chart` })
    .locator("ol > li");
}

/**
 * The server actions (reorderDepthChartAction / setRosterLockedAction) POST
 * back to the depth-chart page URL — awaiting that response is how we know
 * the Convex write landed before we reload and assert persistence.
 */
function waitForDepthChartAction(page: Page) {
  return page.waitForResponse(
    (res) =>
      res.request().method() === "POST" && res.url().includes("/depth-chart"),
  );
}

test.describe.serial("Depth Chart — drag reorder (WSM-000197)", () => {
  let fixture: RosterFixtureResult | null = null;
  let teardown: (() => Promise<void>) | null = null;

  test.beforeAll(async () => {
    const orgId = getTestOrgId();
    test.skip(!orgId, "E2E_CLERK_ORG_ID not set");
    const handle = await withRosterFixture({
      fixtureKey: "depth-chart-reorder",
      clerkOrgId: orgId,
      teamName: "E2E Depth Chart Reorder Team",
      rosterLimit: 53,
      seedActivePlayers: 3,
      extraBenchPlayers: 0,
      positionSlot: "QB",
      seedDepthChartEntries: true,
    });
    fixture = handle.fixture;
    teardown = handle.teardown;
  });

  test.afterAll(async () => {
    if (teardown) await teardown();
  });

  test.beforeEach(async ({ page }) => {
    await setupClerkTestingToken({ page });
  });

  test("coach can drag-reorder players within a position slot", async ({
    page,
  }) => {
    if (!fixture) test.skip();
    await page.goto(`/dashboard/teams/${fixture!.teamId}/depth-chart`);

    // Seeded order from the depthChartEntries (sortOrder 0..2).
    const rows = columnRows(page, "QB");
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0)).toContainText("E2E Player 1");
    await expect(rows.nth(1)).toContainText("E2E Player 2");
    await expect(rows.nth(2)).toContainText("E2E Player 3");

    // Drag Player 1's handle onto Player 3's row. The MouseSensor activates
    // after 4px of travel (see PositionColumn), so: press, nudge past the
    // activation distance, then glide to the target in small steps so
    // @dnd-kit's collision detection tracks the pointer.
    const handle = page.getByRole("button", { name: "Drag E2E Player 1" });
    const source = await handle.boundingBox();
    const target = await rows.nth(2).boundingBox();
    expect(source).not.toBeNull();
    expect(target).not.toBeNull();

    const actionDone = waitForDepthChartAction(page);
    await page.mouse.move(
      source!.x + source!.width / 2,
      source!.y + source!.height / 2,
    );
    await page.mouse.down();
    // Clear the 4px activation constraint before heading to the target.
    await page.mouse.move(
      source!.x + source!.width / 2,
      source!.y + source!.height / 2 + 8,
    );
    await page.mouse.move(
      target!.x + target!.width / 2,
      target!.y + target!.height / 2,
      { steps: 12 },
    );
    await page.mouse.up();

    // Optimistic UI: Player 1 moved to the bottom.
    await expect(rows.nth(0)).toContainText("E2E Player 2");
    await expect(rows.nth(1)).toContainText("E2E Player 3");
    await expect(rows.nth(2)).toContainText("E2E Player 1");

    // Wait for the reorder server action to land, then refresh — the new
    // sortOrder must come back from Convex, not client state.
    await actionDone;
    await page.reload();
    const rowsAfter = columnRows(page, "QB");
    await expect(rowsAfter).toHaveCount(3);
    await expect(rowsAfter.nth(0)).toContainText("E2E Player 2");
    await expect(rowsAfter.nth(1)).toContainText("E2E Player 3");
    await expect(rowsAfter.nth(2)).toContainText("E2E Player 1");
  });
});

test.describe.serial("Depth Chart — roster lock (WSM-000197)", () => {
  let fixture: RosterFixtureResult | null = null;
  let teardown: (() => Promise<void>) | null = null;

  test.beforeAll(async () => {
    const orgId = getTestOrgId();
    test.skip(!orgId, "E2E_CLERK_ORG_ID not set");
    const handle = await withRosterFixture({
      fixtureKey: "depth-chart-lock",
      clerkOrgId: orgId,
      teamName: "E2E Depth Chart Lock Team",
      rosterLimit: 53,
      seedActivePlayers: 3,
      extraBenchPlayers: 0,
      positionSlot: "QB",
      seedDepthChartEntries: true,
    });
    fixture = handle.fixture;
    teardown = handle.teardown;
  });

  test.afterAll(async () => {
    if (teardown) await teardown();
  });

  test.beforeEach(async ({ page }) => {
    await setupClerkTestingToken({ page });
  });

  // The CI test users are org admins, and admins share the coach's edit path:
  // `disabled = rosterLocked || !canEdit` (DepthChartBoard → PositionColumn),
  // so locked handles behave identically for both roles. The server-side
  // `season_locked` rejection of reorderDepthChart is unit-covered in
  // convex/__tests__/depthChart.test.ts; this spec covers the UI enforcement
  // plus persistence of the lock across a reload.
  test("admin roster-lock disables drag handles for coach", async ({
    page,
  }) => {
    if (!fixture) test.skip();
    await page.goto(`/dashboard/teams/${fixture!.teamId}/depth-chart`);

    // Unlocked: banner reports it and the handles are draggable.
    await expect(page.getByText("Roster is unlocked")).toBeVisible();
    const handles = page.getByRole("button", { name: /^Drag / });
    await expect(handles.first()).toBeEnabled();

    // Admin flips the lock; the action persists it via setRosterLocked.
    const actionDone = waitForDepthChartAction(page);
    await page.getByRole("button", { name: "Lock roster" }).click();
    await actionDone;

    await expect(
      page.getByText("Roster locked — drag handles are disabled"),
    ).toBeVisible();
    await expect(handles.first()).toBeDisabled();

    // Reload — the lock came back from Convex, and every handle is disabled.
    await page.reload();
    await expect(
      page.getByText("Roster locked — drag handles are disabled"),
    ).toBeVisible();
    const handlesAfter = page.getByRole("button", { name: /^Drag / });
    await expect(handlesAfter).toHaveCount(3);
    for (let i = 0; i < 3; i++) {
      await expect(handlesAfter.nth(i)).toBeDisabled();
    }
  });
});

test.describe.serial("Depth Chart — cross-org isolation (WSM-000197)", () => {
  let fixture: RosterFixtureResult | null = null;
  let teardown: (() => Promise<void>) | null = null;

  test.beforeAll(async () => {
    const orgIdB = getTestOrgIdB();
    test.skip(!orgIdB, "E2E_CLERK_ORG_ID_B not set");
    // Team B lives in Org B; the shared storageState user (A) is a member of
    // Org A only.
    const handle = await withRosterFixture({
      fixtureKey: "depth-chart-cross-org",
      clerkOrgId: orgIdB,
      teamName: "E2E Depth Chart Org B Team",
      rosterLimit: 53,
      seedActivePlayers: 3,
      extraBenchPlayers: 0,
      positionSlot: "QB",
      seedDepthChartEntries: true,
    });
    fixture = handle.fixture;
    teardown = handle.teardown;
  });

  test.afterAll(async () => {
    if (teardown) await teardown();
  });

  test.beforeEach(async ({ page }) => {
    await setupClerkTestingToken({ page });
  });

  // The depth-chart page and reorderDepthChartAction enforce the same guard:
  // resolveOrgRole(league org, caller) returns null for a non-member, which
  // the page turns into notFound() and the action into `not_authorized`.
  // Invoking the server action directly would require the build-specific
  // Next-Action ID, so we assert the shared guard at the page boundary —
  // the coach of team A never reaches team B's board (no handles to drag),
  // matching the cross-org pattern in coach-roster.spec.ts (WSM-000025).
  test("coach of team A cannot reorder team B", async ({ page }) => {
    if (!fixture) test.skip();
    await page.goto(`/dashboard/teams/${fixture!.teamId}/depth-chart`);

    await expect(page.getByRole("heading", { name: /^404$/ })).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: "E2E Depth Chart Org B Team — Depth Chart",
      }),
    ).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Drag / })).toHaveCount(0);
  });
});

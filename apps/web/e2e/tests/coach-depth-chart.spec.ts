import { test, expect } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";
import { readCanonicalFixture, setActiveLeague } from "../helpers/seed-canonical";
import { TEAMS } from "../helpers/test-data";
import {
  withRosterFixture,
  getTestOrgId,
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

  test.fixme(
    "coach can drag-reorder players within a position slot",
    async () => {
      // Requires a Convex seed harness (team, season rosterLocked=false,
      // 3 players at the same positionSlot, 3 depthChartEntries). When the
      // harness lands, drive the sortable via @dnd-kit/core pointer events
      // and assert sortOrder persists after refresh.
    },
  );

  test.fixme(
    "admin roster-lock disables drag handles for coach",
    async () => {
      // Requires two Clerk test users (coach + admin) + Convex seed. Admin
      // toggles setRosterLocked(true); coach reloads and drag handles
      // become disabled; calling reorderDepthChartAction should reject
      // with `season_locked`.
    },
  );

  test.fixme(
    "coach of team A cannot reorder team B",
    async () => {
      // Requires two teams in different orgs. Invoke reorderDepthChart
      // for team B while authenticated as coach of team A; expect the
      // server action to throw `not_authorized`.
    },
  );
});

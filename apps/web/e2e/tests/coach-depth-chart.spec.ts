import { test, expect } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";
import { TEAMS } from "../helpers/test-data";

test.describe("Depth Chart (WSM-000007)", () => {
  test.beforeEach(async ({ page }) => {
    await setupClerkTestingToken({ page });
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
    const body = page.locator("body");
    await expect(body).toBeVisible();
    const notFoundHeading = page.getByRole("heading", {
      name: /404|Not Found|Page not found/i,
    });
    await expect(notFoundHeading).toHaveCount(0);
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

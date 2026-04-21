import { test, expect } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";
import { TEAMS } from "../helpers/test-data";

test.describe("Roster management (WSM-000019)", () => {
  test.beforeEach(async ({ page }) => {
    await setupClerkTestingToken({ page });
  });

  test("flag-gated roster route is reachable in dev", async ({ page }) => {
    await page.goto("/dashboard/teams");
    const teamLink = page.locator("a", { hasText: TEAMS.COWBOYS.name });
    await teamLink.waitFor({ state: "visible" });
    const href = await teamLink.getAttribute("href");
    expect(href).toBeTruthy();
    await page.goto(`${href}/roster`);
    const body = page.locator("body");
    await expect(body).toBeVisible();
    const notFoundHeading = page.getByRole("heading", {
      name: /404|Not Found|Page not found/i,
    });
    await expect(notFoundHeading).toHaveCount(0);
  });

  test("audit log route renders for the same team", async ({ page }) => {
    await page.goto("/dashboard/teams");
    const teamLink = page.locator("a", { hasText: TEAMS.COWBOYS.name });
    await teamLink.waitFor({ state: "visible" });
    const href = await teamLink.getAttribute("href");
    expect(href).toBeTruthy();
    await page.goto(`${href}/roster/audit`);
    const notFoundHeading = page.getByRole("heading", {
      name: /404|Not Found|Page not found/i,
    });
    await expect(notFoundHeading).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: /Roster Audit Log/i }),
    ).toBeVisible();
  });

  test.fixme(
    "coach assigns a player; active count increments",
    async () => {
      // Requires Convex seed harness (team, active season rosterLocked=false,
      // one eligible player not yet on the active roster). Open
      // AssignPlayerDialog, pick the player, submit, expect the active
      // counter in RosterLimitBadge to increment and a new row to appear
      // in the positionSlot column.
    },
  );

  test.fixme(
    "roster limit blocks a new assignment",
    async () => {
      // Requires Convex seed harness seeded to team.rosterLimit exactly.
      // Attempt to assign another eligible player and expect the mutation
      // to reject with roster_limit_exceeded + toast message + disabled
      // Add to Roster button after reload.
    },
  );

  test.fixme(
    "move active player to IR removes from active and appears in IR tab",
    async () => {
      // Requires Convex seed harness with an active assignment. Use the row
      // dropdown "Move to IR" action; confirm the row disappears from the
      // active list and appears in the IR filter with depthRank=0.
    },
  );

  test.fixme(
    "reactivate from IR respects roster limit",
    async () => {
      // Requires Convex seed harness with one IR assignment and active roster
      // already at team.rosterLimit. Press Reactivate and expect
      // roster_limit_exceeded + toast. Free a slot (release another player)
      // and retry; expect the reactivate to succeed and the row to rejoin
      // the active list with depthRank=highestSlotRank+1.
    },
  );

  test.fixme(
    "audit log timeline reflects assign → IR → reactivate cycle",
    async () => {
      // Requires Convex seed harness. Perform the cycle above, then navigate
      // to /roster/audit and expect three rows in order: status_change
      // (active → ir), status_change (ir → active), plus the original
      // assign. Filter by player and assert the same three rows remain.
    },
  );

  test.fixme(
    "coach of team A cannot mutate team B roster",
    async () => {
      // Requires two teams in different orgs. Invoke
      // assignPlayerToRosterAction for team B while authenticated as coach
      // of team A; expect the server action to throw `not_authorized`.
    },
  );
});

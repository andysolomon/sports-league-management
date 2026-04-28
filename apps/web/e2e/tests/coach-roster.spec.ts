import { test, expect } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";
import { TEAMS } from "../helpers/test-data";
import {
  withRosterFixture,
  getTestOrgId,
  type RosterFixtureResult,
} from "../helpers/seed-roster";
import { signInTestUser } from "../helpers/clerk-signin";

test.describe("Roster management (WSM-000019)", () => {
  test.beforeEach(async ({ page }) => {
    await setupClerkTestingToken({ page });
    await signInTestUser(page);
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
});

// Live, seeded scenarios live in their own describe so the fixture lifecycle is
// scoped to the tests that actually need it. Skips automatically when the
// runtime prerequisites (CONVEX_ENABLE_E2E_SEED on the deployment, the env
// vars below) aren't satisfied.
test.describe.serial("Roster management — assign flow (WSM-000022)", () => {
  let fixture: RosterFixtureResult | null = null;
  let teardown: (() => Promise<void>) | null = null;

  test.beforeAll(async () => {
    const orgId = getTestOrgId();
    test.skip(
      !orgId,
      "E2E_CLERK_ORG_ID not set — skipping seeded roster scenarios.",
    );
    const handle = await withRosterFixture({
      fixtureKey: "coach-roster-assign",
      clerkOrgId: orgId,
      teamName: "E2E Assign Test Team",
      rosterLimit: 53,
      seedActivePlayers: 0,
      extraBenchPlayers: 3,
      positionSlot: "QB",
    });
    fixture = handle.fixture;
    teardown = handle.teardown;
  });

  test.afterAll(async () => {
    if (teardown) await teardown();
  });

  test.beforeEach(async ({ page }) => {
    await setupClerkTestingToken({ page });
    await signInTestUser(page);
  });

  test("coach assigns a bench player; active count goes 0 → 1", async ({
    page,
  }) => {
    if (!fixture) test.skip();
    const teamId = fixture!.teamId;

    await page.goto(`/dashboard/teams/${teamId}/roster`);

    // Page loaded — header reflects the seeded team.
    await expect(
      page.getByRole("heading", { name: /E2E Assign Test Team/ }),
    ).toBeVisible();

    // Limit badge starts empty.
    await expect(
      page.getByLabel("0 of 53 roster slots used"),
    ).toBeVisible();

    // Open dialog.
    await page.getByRole("button", { name: "Add to Roster" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Pick the first seeded player.
    await dialog.getByLabel("Player").click();
    await page
      .getByRole("option", { name: /E2E Player 1/ })
      .click();

    // Submit (dialog footer button text is "Add to roster" — lowercase r).
    await dialog
      .getByRole("button", { name: "Add to roster" })
      .click();

    // Dialog closes, badge updates, player appears under the active QB slot.
    await expect(dialog).toBeHidden();
    await expect(
      page.getByLabel("1 of 53 roster slots used"),
    ).toBeVisible();
    await expect(page.getByText(/E2E Player 1/).first()).toBeVisible();
  });
});

test.describe("Roster management — parked scenarios (WSM-000019)", () => {

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

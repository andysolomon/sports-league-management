import { test, expect } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";
import {
  withRosterFixture,
  getTestOrgId,
  getTestOrgIdB,
  type RosterFixtureResult,
} from "../helpers/seed-roster";
import { signInTestUser } from "../helpers/clerk-signin";

// Reachability smoke for the roster + audit routes. Originally these
// drove the dashboard team list and clicked through to a Salesforce-mirrored
// Cowboys team — that coupled the spec to whatever local seed state happened
// to exist in Convex. Now both tests stand up their own org-owned fixture
// via withRosterFixture, navigate directly via the Convex teamId, and
// assert the page renders for an authorized user.
test.describe.serial("Roster management — reachability (WSM-000019)", () => {
  let fixture: RosterFixtureResult | null = null;
  let teardown: (() => Promise<void>) | null = null;

  test.beforeAll(async () => {
    const orgId = getTestOrgId();
    test.skip(!orgId, "E2E_CLERK_ORG_ID not set");
    const handle = await withRosterFixture({
      fixtureKey: "coach-roster-reachability",
      clerkOrgId: orgId,
      teamName: "E2E Reachability Test Team",
      rosterLimit: 53,
      seedActivePlayers: 0,
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
    await setupClerkTestingToken({ page });
    await signInTestUser(page);
  });

  test("flag-gated roster route renders for an org-owned team", async ({
    page,
  }) => {
    if (!fixture) test.skip();
    await page.goto(`/dashboard/teams/${fixture!.teamId}/roster`);
    await expect(
      page.getByRole("heading", { name: /E2E Reachability Test Team/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: /404|Not Found|Page not found/i,
      }),
    ).toHaveCount(0);
  });

  test("audit log route renders for the same team", async ({ page }) => {
    if (!fixture) test.skip();
    await page.goto(`/dashboard/teams/${fixture!.teamId}/roster/audit`);
    await expect(
      page.getByRole("heading", { name: /Roster Audit Log/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: /404|Not Found|Page not found/i,
      }),
    ).toHaveCount(0);
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

test.describe.serial(
  "Roster management — limit-blocked (WSM-000023)",
  () => {
    let fixture: RosterFixtureResult | null = null;
    let teardown: (() => Promise<void>) | null = null;

    test.beforeAll(async () => {
      const orgId = getTestOrgId();
      test.skip(!orgId, "E2E_CLERK_ORG_ID not set");
      const handle = await withRosterFixture({
        fixtureKey: "coach-roster-limit",
        clerkOrgId: orgId,
        teamName: "E2E Limit Test Team",
        rosterLimit: 2,
        seedActivePlayers: 2,
        extraBenchPlayers: 1,
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

    test("Add to Roster is disabled when active count meets limit", async ({
      page,
    }) => {
      if (!fixture) test.skip();
      await page.goto(`/dashboard/teams/${fixture!.teamId}/roster`);

      await expect(
        page.getByLabel("2 of 2 roster slots used"),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Add to Roster" }),
      ).toBeDisabled();
    });
  },
);

test.describe.serial("Roster management — IR cycle (WSM-000023)", () => {
  let fixture: RosterFixtureResult | null = null;
  let teardown: (() => Promise<void>) | null = null;

  test.beforeAll(async () => {
    const orgId = getTestOrgId();
    test.skip(!orgId, "E2E_CLERK_ORG_ID not set");
    const handle = await withRosterFixture({
      fixtureKey: "coach-roster-ir",
      clerkOrgId: orgId,
      teamName: "E2E IR Test Team",
      rosterLimit: 53,
      seedActivePlayers: 2,
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
    await setupClerkTestingToken({ page });
    await signInTestUser(page);
  });

  test("moving an active player to IR moves them under the IR tab", async ({
    page,
  }) => {
    if (!fixture) test.skip();
    await page.goto(`/dashboard/teams/${fixture!.teamId}/roster`);

    await expect(
      page.getByLabel("2 of 53 roster slots used"),
    ).toBeVisible();

    // Open the per-row dropdown for E2E Player 1 and pick Move to IR.
    await page
      .getByRole("button", { name: /Actions for E2E Player 1/ })
      .click();
    await page.getByRole("menuitem", { name: "Move to IR" }).click();

    // Active count drops, IR tab now reports 1 entry.
    await expect(
      page.getByLabel("1 of 53 roster slots used"),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /^IR \(1\)$/ }),
    ).toBeVisible();

    // Active list no longer shows Player 1 (under the active section).
    const activeSection = page.getByRole("region", { name: "Active roster" });
    await expect(
      activeSection.getByText(/E2E Player 1/),
    ).toHaveCount(0);

    // Click the IR filter chip; the moved player surfaces in the non-active list.
    await page.getByRole("button", { name: /^IR \(1\)$/ }).click();
    const nonActiveSection = page.getByRole("region", {
      name: "Non-active roster",
    });
    await expect(nonActiveSection.getByText(/E2E Player 1/)).toBeVisible();
  });
});

test.describe.serial(
  "Roster management — reactivate respects limit (WSM-000023)",
  () => {
    let fixture: RosterFixtureResult | null = null;
    let teardown: (() => Promise<void>) | null = null;

    test.beforeAll(async () => {
      const orgId = getTestOrgId();
      test.skip(!orgId, "E2E_CLERK_ORG_ID not set");
      // 1 active + 1 bench, limit = 1. After moving the active to IR and
      // adding the bench, we'll be at the limit again — perfect setup for
      // testing roster_limit_exceeded on reactivate.
      const handle = await withRosterFixture({
        fixtureKey: "coach-roster-reactivate",
        clerkOrgId: orgId,
        teamName: "E2E Reactivate Test Team",
        rosterLimit: 1,
        seedActivePlayers: 1,
        extraBenchPlayers: 1,
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

    test("reactivate is rejected at limit, then succeeds after a release", async ({
      page,
    }) => {
      if (!fixture) test.skip();
      await page.goto(`/dashboard/teams/${fixture!.teamId}/roster`);

      // Step 1 — move the only active to IR (now 0/1 active, 1 IR, 1 bench).
      await page
        .getByRole("button", { name: /Actions for E2E Player 1/ })
        .click();
      await page.getByRole("menuitem", { name: "Move to IR" }).click();
      await expect(
        page.getByLabel("0 of 1 roster slots used"),
      ).toBeVisible();

      // Step 2 — fill the active slot with the bench player.
      await page.getByRole("button", { name: "Add to Roster" }).click();
      const dialog = page.getByRole("dialog");
      await dialog.getByLabel("Player").click();
      await page.getByRole("option", { name: /E2E Player 2/ }).click();
      await dialog.getByRole("button", { name: "Add to roster" }).click();
      await expect(dialog).toBeHidden();
      await expect(
        page.getByLabel("1 of 1 roster slots used"),
      ).toBeVisible();

      // Step 3 — try to reactivate the IR row. UI disables Reactivate at
      // limit (atLimit prop on RosterStatusList), so the button is the
      // user-visible enforcement of roster_limit_exceeded.
      await page.getByRole("button", { name: /^IR \(1\)$/ }).click();
      const nonActive = page.getByRole("region", {
        name: "Non-active roster",
      });
      const reactivate = nonActive.getByRole("button", {
        name: "Reactivate",
      });
      await expect(reactivate).toBeDisabled();

      // Step 4 — release the active row to free a slot.
      const activeSection = page.getByRole("region", {
        name: "Active roster",
      });
      await activeSection
        .getByRole("button", { name: /Actions for E2E Player 2/ })
        .click();
      await page.getByRole("menuitem", { name: "Release" }).click();
      await expect(
        page.getByLabel("0 of 1 roster slots used"),
      ).toBeVisible();

      // Step 5 — reactivate now succeeds.
      await page.getByRole("button", { name: /^IR \(1\)$/ }).click();
      await nonActive
        .getByRole("button", { name: "Reactivate" })
        .first()
        .click();
      await expect(
        page.getByLabel("1 of 1 roster slots used"),
      ).toBeVisible();
    });
  },
);

test.describe.serial(
  "Roster management — audit timeline reflects mutations (WSM-000023)",
  () => {
    let fixture: RosterFixtureResult | null = null;
    let teardown: (() => Promise<void>) | null = null;

    test.beforeAll(async () => {
      const orgId = getTestOrgId();
      test.skip(!orgId, "E2E_CLERK_ORG_ID not set");
      const handle = await withRosterFixture({
        fixtureKey: "coach-roster-audit",
        clerkOrgId: orgId,
        teamName: "E2E Audit Test Team",
        rosterLimit: 53,
        seedActivePlayers: 0,
        extraBenchPlayers: 1,
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

    test("assign → IR → reactivate produces three audit rows", async ({
      page,
    }) => {
      if (!fixture) test.skip();
      await page.goto(`/dashboard/teams/${fixture!.teamId}/roster`);

      // Drive the cycle: assign, then IR, then reactivate.
      await page.getByRole("button", { name: "Add to Roster" }).click();
      const dialog = page.getByRole("dialog");
      await dialog.getByLabel("Player").click();
      await page.getByRole("option", { name: /E2E Player 1/ }).click();
      await dialog.getByRole("button", { name: "Add to roster" }).click();
      await expect(dialog).toBeHidden();
      await expect(
        page.getByLabel("1 of 53 roster slots used"),
      ).toBeVisible();

      await page
        .getByRole("button", { name: /Actions for E2E Player 1/ })
        .click();
      await page.getByRole("menuitem", { name: "Move to IR" }).click();
      await expect(
        page.getByLabel("0 of 53 roster slots used"),
      ).toBeVisible();

      await page.getByRole("button", { name: /^IR \(1\)$/ }).click();
      const nonActive = page.getByRole("region", {
        name: "Non-active roster",
      });
      await nonActive.getByRole("button", { name: "Reactivate" }).click();
      await expect(
        page.getByLabel("1 of 53 roster slots used"),
      ).toBeVisible();

      // Visit the audit timeline and assert three rows for our cycle.
      await page.goto(
        `/dashboard/teams/${fixture!.teamId}/roster/audit`,
      );
      await expect(
        page.getByRole("heading", { name: /Roster Audit Log/ }),
      ).toBeVisible();

      // Audit chips render the action label with underscores replaced by
      // spaces, so we expect: one "assign" + two "status change" rows.
      await expect(page.getByText("assign", { exact: true })).toHaveCount(1);
      await expect(
        page.getByText("status change", { exact: true }),
      ).toHaveCount(2);
    });
  },
);

test.describe.serial(
  "Roster management — cross-org isolation (WSM-000025)",
  () => {
    let fixture: RosterFixtureResult | null = null;
    let teardown: (() => Promise<void>) | null = null;

    test.beforeAll(async () => {
      const orgIdA = getTestOrgId();
      const orgIdB = getTestOrgIdB();
      test.skip(
        !orgIdA || !orgIdB,
        "E2E_CLERK_ORG_ID and E2E_CLERK_ORG_ID_B both required for cross-org spec.",
      );
      // Fixture league belongs to Org A. The test signs in as User B
      // (member of Org B only) and asserts the page rejects them.
      const handle = await withRosterFixture({
        fixtureKey: "coach-roster-cross-org",
        clerkOrgId: orgIdA,
        teamName: "E2E Cross-Org Test Team",
        rosterLimit: 53,
        seedActivePlayers: 0,
        extraBenchPlayers: 1,
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
      await signInTestUser(page, { userVariant: "B" });
    });

    test("user from Org B cannot reach a roster owned by Org A", async ({
      page,
    }) => {
      if (!fixture) test.skip();
      await page.goto(`/dashboard/teams/${fixture!.teamId}/roster`);

      // The roster page calls notFound() when getUserRoleInOrg returns null
      // for the signed-in user against the league's org. User B is admin of
      // Org B but not a member of Org A — so Next.js renders its 404 page.
      await expect(
        page.getByRole("heading", { name: /^404$/ }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", {
          name: /E2E Cross-Org Test Team/,
        }),
      ).toHaveCount(0);
    });

    test("user from Org B cannot reach the audit log of an Org A roster", async ({
      page,
    }) => {
      if (!fixture) test.skip();
      await page.goto(`/dashboard/teams/${fixture!.teamId}/roster/audit`);

      await expect(
        page.getByRole("heading", { name: /^404$/ }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: /Roster Audit Log/i }),
      ).toHaveCount(0);
    });
  },
);

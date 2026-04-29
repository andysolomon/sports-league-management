import { test, expect } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";
import {
  withRosterFixture,
  getTestOrgId,
  type RosterFixtureResult,
} from "../helpers/seed-roster";
import { signInTestUser } from "../helpers/clerk-signin";

/*
 * Sprint 5 smoke (WSM-000049).
 *
 * After the SF → Convex read-path swap, every dashboard list page
 * should render its server component without throwing the
 * "Server Components render" 500 we hit in production while
 * Salesforce JWT auth was broken. This spec walks the tree
 * authenticated and asserts each route renders the expected
 * heading / no error UI.
 *
 * The fixture exists primarily so the user has a non-zero
 * visibleLeagueIds set — the test cares about "page renders" not
 * specific counts, since the Convex backend may have variable seed
 * data across local + CI.
 */
test.describe.serial(
  "Dashboard tree — Convex read smoke (WSM-000049)",
  () => {
    let fixture: RosterFixtureResult | null = null;
    let teardown: (() => Promise<void>) | null = null;

    test.beforeAll(async () => {
      const orgId = getTestOrgId();
      test.skip(!orgId, "E2E_CLERK_ORG_ID not set");
      const handle = await withRosterFixture({
        fixtureKey: "dashboard-tree-smoke",
        clerkOrgId: orgId,
        teamName: "E2E Smoke Team",
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

    test("dashboard root renders Overview + 5 stat cards (no error)", async ({
      page,
    }) => {
      if (!fixture) test.skip();
      await page.goto("/dashboard");

      await expect(
        page.getByRole("heading", { name: "Overview" }),
      ).toBeVisible();
      // No degradation banner (the SF degradation banner was removed
      // in WSM-000045 because Convex can't fail on JWT auth).
      await expect(
        page.getByText("Live data is temporarily unavailable"),
      ).toHaveCount(0);
      await expect(
        page.getByRole("heading", { name: /Something went wrong/i }),
      ).toHaveCount(0);

      // 5 stat card labels render.
      for (const label of [
        "Leagues",
        "Teams",
        "Players",
        "Seasons",
        "Divisions",
      ]) {
        await expect(
          page.getByText(label, { exact: true }).first(),
        ).toBeVisible();
      }
    });

    test("each list page renders its heading (no 500)", async ({ page }) => {
      if (!fixture) test.skip();
      const routes: Array<{ path: string; heading: RegExp }> = [
        { path: "/dashboard/leagues", heading: /Leagues/ },
        { path: "/dashboard/teams", heading: /Teams/ },
        { path: "/dashboard/players", heading: /Players/ },
        { path: "/dashboard/seasons", heading: /Seasons/ },
        { path: "/dashboard/divisions", heading: /Divisions/ },
      ];

      for (const { path, heading } of routes) {
        await page.goto(path);
        await expect(
          page.getByRole("heading", { name: heading }).first(),
        ).toBeVisible();
        await expect(
          page.getByRole("heading", { name: /Something went wrong/i }),
        ).toHaveCount(0);
      }
    });
  },
);

import fs from "node:fs";
import path from "node:path";
import { test } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";

/**
 * Prod screenshot sweep (WSM-000188). One full-page screenshot per route, per
 * viewport project (desktop / mobile), written to
 * `prod-screenshots/<project>/<slug>.png` and uploaded as a CI artifact.
 *
 * Read-only: navigate + screenshot only. Authed pages rely on the prod
 * storageState (see playwright.prod.ts); `setupClerkTestingToken` keeps the
 * session refreshable. The two legal pages are public and render the same
 * signed-in or out.
 */
const ROUTES: Array<{ slug: string; path: string }> = [
  { slug: "dashboard-overview", path: "/dashboard" },
  { slug: "leagues", path: "/dashboard/leagues" },
  { slug: "teams", path: "/dashboard/teams" },
  { slug: "players", path: "/dashboard/players" },
  { slug: "seasons", path: "/dashboard/seasons" },
  { slug: "divisions", path: "/dashboard/teams?view=divisions" },
  { slug: "discover", path: "/dashboard/discover" },
  { slug: "import", path: "/dashboard/import" },
  { slug: "billing", path: "/dashboard/billing" },
  { slug: "roles", path: "/dashboard/roles" },
  { slug: "legal-privacy", path: "/privacy" },
  { slug: "legal-terms", path: "/terms" },
];

test.describe("Prod screenshot sweep", () => {
  test.beforeEach(async ({ page }) => {
    await setupClerkTestingToken({ page });
  });

  for (const route of ROUTES) {
    test(`screenshot ${route.slug}`, async ({ page }, testInfo) => {
      const dir = path.resolve("prod-screenshots", testInfo.project.name);
      fs.mkdirSync(dir, { recursive: true });

      // `load` (not networkidle): the Convex client holds a persistent
      // websocket, so networkidle never settles. Then a short pause lets
      // data-driven content (charts, tables) finish rendering before the shot.
      await page.goto(route.path, { waitUntil: "load" });
      await page.waitForTimeout(2_000);

      await page.screenshot({
        path: path.join(dir, `${route.slug}.png`),
        fullPage: true,
      });
    });
  }
});

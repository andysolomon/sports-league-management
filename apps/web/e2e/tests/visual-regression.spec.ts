import { test, expect, type Page } from "@playwright/test";

/**
 * Visual-regression baselines for the two visual-heavy components
 * (WSM-000082): PixelLineChart and StandingsTable, plus workspace hub chrome
 * (WSM-000236 / WSM-000252). They render in dedicated `/dev/visual/*` harness
 * routes with fixed, deterministic data — no Convex, no Clerk, no seed — so
 * the screenshots are stable.
 *
 * ## Why a separate project
 * Runs under the Playwright `visual` project (see playwright.config.ts) at a
 * fixed 1000×900 viewport. It only needs the dev server up — none of the
 * Convex/Clerk fixtures the other specs use.
 *
 * ## Determinism
 * - Animations disabled + `maxDiffPixelRatio: 0.01` (config-level) absorb
 *   sub-pixel font anti-aliasing.
 * - We await `document.fonts.ready` so the 8-bit webfont is loaded before the
 *   shot — otherwise the first run captures a fallback font.
 * - Baselines are OS-specific: Playwright suffixes them (`-darwin`, `-linux`),
 *   so committing macOS baselines does NOT clobber CI's Linux baselines.
 *
 * ## Updating baselines
 *   pnpm exec playwright test --config e2e/playwright.config.ts \
 *     --project visual --update-snapshots
 * Commit the regenerated `*-snapshots/` PNGs. In CI (Linux), generate the
 * `-linux` baselines the same way inside the CI container, then commit them —
 * review the diff artifacts in the Playwright HTML report before accepting.
 */

async function waitForReady(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
}

test.describe("Visual regression (WSM-000082)", () => {
  test("PixelLineChart — multi-season, single, empty", async ({ page }) => {
    await waitForReady(page, "/dev/visual/pixel-line-chart");
    await expect(page.getByTestId("chart-multi")).toHaveScreenshot(
      "pixel-line-chart-multi.png",
    );
    await expect(page.getByTestId("chart-single")).toHaveScreenshot(
      "pixel-line-chart-single.png",
    );
    await expect(page.getByTestId("chart-empty")).toHaveScreenshot(
      "pixel-line-chart-empty.png",
    );
  });

  test("StandingsTable — mixed differentials", async ({ page }) => {
    await waitForReady(page, "/dev/visual/standings-table");
    await expect(page.getByTestId("standings")).toHaveScreenshot(
      "standings-table.png",
    );
  });

  test("Workspace shell — league and season variants", async ({ page }) => {
    await waitForReady(page, "/dev/visual/workspace");
    await expect(page.getByTestId("workspace-league")).toHaveScreenshot(
      "workspace-league.png",
    );
    await expect(page.getByTestId("workspace-season")).toHaveScreenshot(
      "workspace-season.png",
    );
  });
});

import path from "node:path";
import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";

// Load .env.local for LOCAL runs (the functional suite gets this for free via
// its convex imports; the prod sweep imports no convex, so load it explicitly).
// In CI the file is absent — a no-op — and env comes from the workflow.
dotenv.config({ path: path.resolve(".env.local") });

/**
 * PROD screenshot sweep (WSM-000188) — separate from the functional suite.
 *
 * Signs in ONCE as the example e2e user against the LIVE production deployment
 * and full-page-screenshots every authed app page at desktop + mobile widths,
 * saving them under `prod-screenshots/<viewport>/`. Read-only: it navigates and
 * screenshots, never seeds or mutates prod data.
 *
 * Target: PROD_BASE_URL (defaults to the custom domain). NO `webServer` — prod
 * is already deployed; we hit it over the network.
 *
 * Auth note: this reuses the same Clerk creds as the functional suite
 * (CLERK_SECRET_KEY + E2E_CLERK_USER_ID). That works today because prod still
 * runs the Clerk DEVELOPMENT instance (#386 cutover pending). After the cutover
 * to a production Clerk instance, point these at a prod-instance secret key +
 * a prod test user (e.g. PROD_CLERK_* secrets).
 */
const PROD_STORAGE_STATE = path.resolve("e2e", ".auth", "prod-user.json");
const BASE_URL =
  process.env.PROD_BASE_URL ?? "https://sprtsmng.andrewsolomon.dev";

export default defineConfig({
  testDir: "./prod",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: [["html", { open: "never" }]],
  globalSetup: "./prod/global-setup.ts",
  use: {
    baseURL: BASE_URL,
    // Capture a trace + screenshot on failure so a broken sweep is debuggable.
    trace: "on-first-retry",
    navigationTimeout: 45_000,
    actionTimeout: 15_000,
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "desktop",
      testMatch: /screenshots\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        storageState: PROD_STORAGE_STATE,
      },
      dependencies: ["setup"],
    },
    {
      name: "mobile",
      testMatch: /screenshots\.spec\.ts/,
      // Chromium at a phone viewport — NOT devices["iPhone 13"], which defaults
      // to WebKit (a second browser to install in CI). isMobile/hasTouch are
      // chromium-supported and give us the mobile layout for the sweep.
      use: {
        browserName: "chromium",
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        storageState: PROD_STORAGE_STATE,
      },
      dependencies: ["setup"],
    },
  ],
});

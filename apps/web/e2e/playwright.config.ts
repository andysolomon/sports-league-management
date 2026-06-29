import path from "node:path";
import { defineConfig } from "@playwright/test";

// Shared Clerk session persisted by auth.setup.ts and reused by authed projects
// (WSM-000172). Resolved from the package cwd (apps/web), like the canonical
// fixture handoff in seed-canonical.ts. Kept in sync with auth.setup.ts.
const STORAGE_STATE = path.resolve("e2e", ".auth", "user.json");

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  retries: 0,
  reporter: [["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    navigationTimeout: 30_000,
    actionTimeout: 15_000,
  },
  // Visual baselines are platform-specific; Playwright suffixes them per OS
  // (…-darwin.png, …-linux.png) so macOS dev and Linux CI don't collide.
  // Because baselines never cross platforms, same-machine renders are
  // deterministic — so the tolerance is tight (0.1%) to catch localized
  // changes like a single chart point moving, not just whole-image shifts.
  // `threshold` still absorbs trivial per-pixel AA noise.
  expect: {
    toHaveScreenshot: {
      animations: "disabled",
      threshold: 0.2,
      maxDiffPixelRatio: 0.001,
    },
  },
  globalSetup: "./global-setup.ts",
  projects: [
    // Sign in ONCE and persist the Clerk session; authed projects reuse it via
    // `storageState`. Replaces ~110 per-test ticket sign-ins that rate-limited
    // Clerk's dev instance and timed out mid-run (WSM-000172). The session
    // cookie auto-refreshes the short-lived JWT, so it survives the serial run.
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    // Signed-OUT API enforcement: its own project with NO storageState and NO
    // setup dependency, so requests carry no session — asserts protected BFF
    // routes return 401. (Sharing the chromium project would leak the session.)
    {
      name: "api",
      testMatch: "api-auth.spec.ts",
      use: { browserName: "chromium" },
    },
    {
      name: "health",
      testMatch: "health.spec.ts",
      use: { browserName: "chromium", storageState: STORAGE_STATE },
      dependencies: ["setup"],
    },
    {
      name: "chromium",
      testIgnore: [
        "health.spec.ts",
        "visual-regression.spec.ts",
        "api-auth.spec.ts",
      ],
      use: { browserName: "chromium", storageState: STORAGE_STATE },
      dependencies: ["setup", "health"],
    },
    // Visual regression runs the pure-component harnesses (no Convex/auth),
    // at a fixed viewport for deterministic screenshots. No auth/state needed:
    // the harness routes need only the dev server (started by webServer).
    {
      name: "visual",
      testMatch: "visual-regression.spec.ts",
      use: { browserName: "chromium", viewport: { width: 1000, height: 900 } },
    },
  ],
  webServer: {
    command: "pnpm dev",
    port: 3000,
    reuseExistingServer: !process.env.CI,
    cwd: "..",
    timeout: 30_000,
    // Surface the Next dev-server console (incl. Server Component / Convex
    // ReturnsValidationError stacks) in the CI job log. Without this Playwright
    // swallows webServer output, so a page that renders the error boundary only
    // shows up as a missing-element assertion with no server-side cause — the
    // failure mode that hid the WSM-000172 dashboard drift behind a stale
    // shared-dev Convex deploy.
    stdout: "pipe",
    stderr: "pipe",
  },
});

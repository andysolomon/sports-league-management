import { defineConfig } from "@playwright/test";

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
    {
      name: "health",
      testMatch: "health.spec.ts",
      use: { browserName: "chromium" },
    },
    {
      name: "chromium",
      // Auth-gated specs sign in per-test (setupClerkTestingToken +
      // signInTestUser) rather than via a shared storageState: Clerk's
      // dev-instance session JWT is short-lived, so a saved session goes stale
      // partway through a serial suite (WSM-000172). api-auth runs
      // unauthenticated here on purpose and asserts 401.
      testIgnore: ["health.spec.ts", "visual-regression.spec.ts"],
      use: { browserName: "chromium" },
      dependencies: ["health"],
    },
    // Visual regression runs the pure-component harnesses (no Convex/auth),
    // at a fixed viewport for deterministic screenshots. No health dependency:
    // the harness routes need only the dev server (started by webServer), not
    // an authenticated session like the smoke/data specs.
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

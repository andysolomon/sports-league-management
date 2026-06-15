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
  },
});

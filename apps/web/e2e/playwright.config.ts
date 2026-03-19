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
  globalSetup: "./global-setup.ts",
  projects: [
    {
      name: "health",
      testMatch: "health.spec.ts",
      use: { browserName: "chromium" },
    },
    {
      name: "chromium",
      testIgnore: "health.spec.ts",
      use: { browserName: "chromium" },
      dependencies: ["health"],
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

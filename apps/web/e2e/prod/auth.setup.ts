import fs from "node:fs";
import path from "node:path";
import { test as setup, expect } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";
import { signInTestUser } from "../helpers/clerk-signin";

/**
 * Prod sweep auth (WSM-000188). Signs in ONCE as the example e2e user against
 * the live prod deployment (baseURL = PROD_BASE_URL) and persists the session
 * so the desktop/mobile screenshot projects reuse it. Mirrors the functional
 * suite's auth.setup but writes a separate prod state file.
 */
const PROD_STORAGE_STATE = path.resolve("e2e", ".auth", "prod-user.json");

setup("authenticate against prod", async ({ page }) => {
  await setupClerkTestingToken({ page });
  await signInTestUser(page);
  fs.mkdirSync(path.dirname(PROD_STORAGE_STATE), { recursive: true });

  // Confirm the SESSION is live before persisting — assert the authenticated
  // shell (sidebar nav), NOT the dashboard content. The sweep must still
  // capture pages whose body renders the error boundary (that's the point of a
  // prod sweep), so liveness must not depend on the content rendering cleanly.
  await page.goto("/dashboard");
  await expect(
    page.getByRole("link", { name: "Overview", exact: true }),
  ).toBeVisible({ timeout: 30_000 });

  await page.context().storageState({ path: PROD_STORAGE_STATE });
});

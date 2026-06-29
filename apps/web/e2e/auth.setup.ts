import fs from "node:fs";
import path from "node:path";
import { test as setup, expect } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";
import { signInTestUser } from "./helpers/clerk-signin";

/**
 * Shared-auth setup (WSM-000172). The suite used to call `signInTestUser` in
 * every spec's `beforeEach` — ~110 ticket sign-ins against a rate-limited Clerk
 * dev instance, which timed out partway through and cascaded the whole run to
 * red. Instead we sign in ONCE here, persist the Clerk session to a storage
 * state file, and every authed project reuses it via `use.storageState`. Specs
 * keep `setupClerkTestingToken({ page })` (per-page bot-bypass) but no longer
 * sign in themselves.
 *
 * `api-auth.spec.ts` runs in its own project WITHOUT this state — it asserts the
 * signed-out 401 path, so it must not inherit a session.
 */
export const STORAGE_STATE = path.resolve("e2e", ".auth", "user.json");

setup("authenticate as the primary e2e user", async ({ page }) => {
  await setupClerkTestingToken({ page });
  await signInTestUser(page);
  fs.mkdirSync(path.dirname(STORAGE_STATE), { recursive: true });

  // Confirm the session is actually live (dashboard renders for the user) before
  // persisting it — a stale/empty state would silently fail every authed spec.
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible({
    timeout: 20_000,
  });

  await page.context().storageState({ path: STORAGE_STATE });
});

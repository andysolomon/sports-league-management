import { clerkSetup } from "@clerk/testing/playwright";
import { FullConfig } from "@playwright/test";
import { seedCanonicalFixture } from "./helpers/seed-canonical";
import { getTestOrgId } from "./helpers/seed-roster";

async function checkSalesforceConnection(baseURL: string) {
  // Hit the dev server root to confirm it's up, then check the API
  // We can't check authenticated routes here (no Clerk token),
  // but we can verify the server is responsive
  const maxRetries = 5;
  for (let i = 0; i < maxRetries; i++) {
    try {
      const resp = await fetch(`${baseURL}/api/leagues`);
      // 401 means server is up and Clerk auth is enforcing — that's healthy
      // 500 would mean Salesforce connection is broken
      if (resp.status === 401) {
        console.log("✓ Health check passed: API server is up, auth is enforcing");
        return;
      }
      if (resp.status >= 500) {
        const body = await resp.text();
        throw new Error(
          `Salesforce API returned ${resp.status}. The Salesforce connection may be broken.\n` +
            `Check SF_LOGIN_URL, SF_CLIENT_ID, SF_USERNAME, and SF_PRIVATE_KEY in .env.local.\n` +
            `Response: ${body.substring(0, 200)}`
        );
      }
      // Any other status (200, 3xx) means server is up
      console.log(`✓ Health check passed: API server responded with ${resp.status}`);
      return;
    } catch (err) {
      if (err instanceof TypeError && err.message.includes("fetch")) {
        // Server not ready yet, retry
        if (i < maxRetries - 1) {
          await new Promise((r) => setTimeout(r, 2000));
          continue;
        }
      }
      throw err;
    }
  }
  throw new Error(`Health check failed: could not reach ${baseURL} after ${maxRetries} retries`);
}

export default async function globalSetup(config: FullConfig) {
  await clerkSetup();

  // Visual regression only needs the Next dev server + /dev/visual harnesses
  // (no Convex seed, no Salesforce). Prefer an explicit opt-out so
  // `test:visual` / `test:visual:update` work without a local Convex backend
  // (WSM-000252). Also skip when the filtered project list is visual-only.
  const visualOnly =
    process.env.PLAYWRIGHT_VISUAL_ONLY === "1" ||
    (config.projects.length > 0 &&
      config.projects.every((project) => project.name === "visual"));
  if (visualOnly) {
    console.log("✓ Skipping Salesforce health + canonical seed (visual-only run)");
    return;
  }

  const baseURL =
    config.projects[0]?.use?.baseURL ?? "http://localhost:3000";
  await checkSalesforceConnection(baseURL);

  // Seed the canonical NFL/MLS dataset ONCE (WSM-000187). The data-dependent
  // specs read the resulting leagueId and set the active-league cookie to it.
  // Idempotent on the Convex side, so re-runs are deterministic.
  const fixture = await seedCanonicalFixture(getTestOrgId());
  console.log(
    `✓ Canonical fixture seeded: league ${fixture.leagueId} (${fixture.teamIds.length} teams, ${fixture.playerIds.length} players, ${fixture.seasonIds.length} seasons)`,
  );
}

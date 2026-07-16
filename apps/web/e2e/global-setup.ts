import { clerkSetup } from "@clerk/testing/playwright";
import { FullConfig } from "@playwright/test";
import { seedCanonicalFixture } from "./helpers/seed-canonical";
import { getTestOrgId } from "./helpers/seed-roster";

async function checkApiHealth(baseURL: string) {
  const maxRetries = 5;
  for (let i = 0; i < maxRetries; i++) {
    try {
      const resp = await fetch(`${baseURL}/api/leagues`);
      // 401 means server is up and Clerk auth is enforcing — that's healthy
      // 500 would mean the API or Convex connection is broken
      if (resp.status === 401) {
        console.log("✓ Health check passed: API server is up, auth is enforcing");
        return;
      }
      if (resp.status >= 500) {
        const body = await resp.text();
        throw new Error(
          `API returned ${resp.status}. The backend connection may be broken.\n` +
            `Check NEXT_PUBLIC_CONVEX_URL and Clerk env vars in .env.local.\n` +
            `Response: ${body.substring(0, 200)}`
        );
      }
      console.log(`✓ Health check passed: API server responded with ${resp.status}`);
      return;
    } catch (err) {
      if (err instanceof TypeError && err.message.includes("fetch")) {
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
  // Visual regression only needs the Next dev server + /dev/visual harnesses
  // (no Clerk testing tokens or Convex seed). Check this BEFORE clerkSetup so
  // `test:visual` / `test:visual:update` stay harness-only (WSM-000252).
  const visualOnly =
    process.env.PLAYWRIGHT_VISUAL_ONLY === "1" ||
    (config.projects.length > 0 &&
      config.projects.every((project) => project.name === "visual"));
  if (visualOnly) {
    console.log("✓ Skipping Clerk setup + API health + canonical seed (visual-only run)");
    return;
  }

  await clerkSetup();

  const baseURL =
    config.projects[0]?.use?.baseURL ?? "http://localhost:3000";
  await checkApiHealth(baseURL);

  const fixture = await seedCanonicalFixture(getTestOrgId());
  console.log(
    `✓ Canonical fixture seeded: league ${fixture.leagueId} (${fixture.teamIds.length} teams, ${fixture.playerIds.length} players, ${fixture.seasonIds.length} seasons)`,
  );
}

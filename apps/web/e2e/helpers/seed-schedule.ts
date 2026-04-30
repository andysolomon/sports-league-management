/**
 * Schedule fixture seed harness — Playwright side.
 *
 * Wraps the Convex `e2eSeed:createScheduleFixture` mutation so the
 * Phase 3 e2e (WSM-000074) can stand up a deterministic
 * league + season + two-team fixture and tear it down cleanly.
 *
 * Runtime prerequisites match `seed-roster.ts`:
 *   - `CONVEX_ENABLE_E2E_SEED=1` on the target Convex deployment
 *   - `NEXT_PUBLIC_CONVEX_URL` (+ `CONVEX_ADMIN_KEY` for non-local)
 *   - `E2E_CLERK_ORG_ID` to scope the seeded league to the test org
 */
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";

export interface ScheduleFixtureConfig {
  fixtureKey: string;
  clerkOrgId: string | null;
  homeTeamName?: string;
  awayTeamName?: string;
}

export interface ScheduleFixtureResult {
  fixtureKey: string;
  leagueId: string;
  seasonId: string;
  homeTeamId: string;
  awayTeamId: string;
  homeTeamName: string;
  awayTeamName: string;
}

const createFixtureRef = makeFunctionReference<
  "mutation",
  any,
  ScheduleFixtureResult
>("e2eSeed:createScheduleFixture");

const resetFixtureRef = makeFunctionReference<
  "mutation",
  any,
  { deleted: number }
>("e2eSeed:resetRosterFixture");

function getSeedClient(): ConvexHttpClient {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  const adminKey = process.env.CONVEX_ADMIN_KEY;

  if (!url) {
    throw new Error(
      "[seed-schedule] NEXT_PUBLIC_CONVEX_URL is required to run the e2e seed harness.",
    );
  }
  const isLocalDeployment =
    url.includes("127.0.0.1") || url.includes("localhost");
  if (!adminKey && !isLocalDeployment) {
    throw new Error(
      "[seed-schedule] CONVEX_ADMIN_KEY is required for non-local deployments.",
    );
  }

  const client = new ConvexHttpClient(url);
  if (adminKey) {
    (
      client as ConvexHttpClient & { setAdminAuth?: (key: string) => void }
    ).setAdminAuth?.(adminKey);
  }
  return client;
}

export async function createScheduleFixture(
  config: ScheduleFixtureConfig,
): Promise<ScheduleFixtureResult> {
  const client = getSeedClient();
  try {
    return await client.mutation(createFixtureRef, config);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("e2e_seed_disabled")) {
      throw new Error(
        "[seed-schedule] Convex rejected the seed mutation — set CONVEX_ENABLE_E2E_SEED=1 on the target deployment.",
      );
    }
    throw err;
  }
}

export async function resetScheduleFixture(
  fixtureKey: string,
): Promise<{ deleted: number }> {
  const client = getSeedClient();
  return client.mutation(resetFixtureRef, { fixtureKey });
}

export async function withScheduleFixture(
  config: ScheduleFixtureConfig,
): Promise<{
  fixture: ScheduleFixtureResult;
  teardown: () => Promise<void>;
}> {
  const fixture = await createScheduleFixture(config);
  return {
    fixture,
    teardown: async () => {
      await resetScheduleFixture(config.fixtureKey);
    },
  };
}

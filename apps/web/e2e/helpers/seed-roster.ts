/**
 * Roster seed harness — Playwright side.
 *
 * Wraps the Convex `e2eSeed` mutations so Playwright specs can stand up
 * and tear down deterministic roster fixtures.
 *
 * Runtime prerequisites (see SPRINT_2_VERIFICATION.md follow-up):
 *   - `CONVEX_ENABLE_E2E_SEED=1` on the target Convex deployment
 *   - `NEXT_PUBLIC_CONVEX_URL` + (for remote deployments) `CONVEX_ADMIN_KEY`
 *     in the Playwright runner environment
 *   - `E2E_CLERK_ORG_ID` for tests that require the fixture league to be
 *     owned by the current Clerk test user's org
 */
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";

export interface RosterFixtureConfig {
  fixtureKey: string;
  clerkOrgId: string | null;
  teamName?: string;
  rosterLimit: number | null;
  rosterLocked?: boolean;
  seedActivePlayers?: number;
  extraBenchPlayers?: number;
  positionSlot?: string;
}

export interface RosterFixtureResult {
  fixtureKey: string;
  leagueId: string;
  seasonId: string;
  teamId: string;
  playerIds: string[];
  activeAssignmentIds: string[];
}

const createFixtureRef = makeFunctionReference<
  "mutation",
  any,
  RosterFixtureResult
>("e2eSeed:createRosterFixture");

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
      "[seed-roster] NEXT_PUBLIC_CONVEX_URL is required to run the e2e seed harness.",
    );
  }
  const isLocalDeployment =
    url.includes("127.0.0.1") || url.includes("localhost");
  if (!adminKey && !isLocalDeployment) {
    throw new Error(
      "[seed-roster] CONVEX_ADMIN_KEY is required for non-local deployments.",
    );
  }

  const client = new ConvexHttpClient(url);
  if (adminKey) {
    (client as ConvexHttpClient & {
      setAdminAuth?: (key: string) => void;
    }).setAdminAuth?.(adminKey);
  }
  return client;
}

export async function createRosterFixture(
  config: RosterFixtureConfig,
): Promise<RosterFixtureResult> {
  const client = getSeedClient();
  try {
    return await client.mutation(createFixtureRef, config);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("e2e_seed_disabled")) {
      throw new Error(
        "[seed-roster] Convex rejected the seed mutation — set CONVEX_ENABLE_E2E_SEED=1 on the target deployment.",
      );
    }
    throw err;
  }
}

export async function resetRosterFixture(
  fixtureKey: string,
): Promise<{ deleted: number }> {
  const client = getSeedClient();
  return client.mutation(resetFixtureRef, { fixtureKey });
}

/**
 * Convenience wrapper for `test.beforeEach` / `test.afterEach`:
 * creates a fresh fixture and returns a teardown handle.
 */
export async function withRosterFixture(
  config: RosterFixtureConfig,
): Promise<{
  fixture: RosterFixtureResult;
  teardown: () => Promise<void>;
}> {
  const fixture = await createRosterFixture(config);
  return {
    fixture,
    teardown: async () => {
      await resetRosterFixture(config.fixtureKey);
    },
  };
}

export function getTestOrgId(): string | null {
  return process.env.E2E_CLERK_ORG_ID ?? null;
}

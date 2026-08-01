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
  /**
   * Teams beyond the home/away pair. A two-team league can hold only one game
   * per week now that a team cannot be booked twice in the same week, so a
   * spec that needs two fixtures in ONE week must seed a second pair.
   */
  extraTeamNames?: string[];
}

export interface ScheduleFixtureResult {
  fixtureKey: string;
  leagueId: string;
  seasonId: string;
  homeTeamId: string;
  awayTeamId: string;
  homeTeamName: string;
  awayTeamName: string;
  extraTeamIds: string[];
  extraTeamNames: string[];
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

const seedHistoryFixtureRef = makeFunctionReference<
  "mutation",
  {
    leagueId: string;
    seasonId: string;
    homeTeamId: string;
    awayTeamId: string;
  },
  { created: number }
>("e2eSeed:seedHistoryFixture");

export async function seedHistoryFixture(
  fixture: ScheduleFixtureResult,
): Promise<{ created: number }> {
  const client = getSeedClient();
  return client.mutation(seedHistoryFixtureRef, {
    leagueId: fixture.leagueId,
    seasonId: fixture.seasonId,
    homeTeamId: fixture.homeTeamId,
    awayTeamId: fixture.awayTeamId,
  });
}

const seedHallOfFameFixtureRef = makeFunctionReference<
  "mutation",
  {
    leagueId: string;
    seasonId: string;
    homeTeamId: string;
    awayTeamId: string;
  },
  { created: number; classLabel: string }
>("e2eSeed:seedHallOfFameFixture");

export async function seedHallOfFameFixture(
  fixture: ScheduleFixtureResult,
): Promise<{ created: number; classLabel: string }> {
  const client = getSeedClient();
  return client.mutation(seedHallOfFameFixtureRef, {
    leagueId: fixture.leagueId,
    seasonId: fixture.seasonId,
    homeTeamId: fixture.homeTeamId,
    awayTeamId: fixture.awayTeamId,
  });
}

const seedAwardsFixtureRef = makeFunctionReference<
  "mutation",
  {
    leagueId: string;
    seasonId: string;
    homeTeamId: string;
    awayTeamId: string;
  },
  { winnerPlayerId: string; awardsCreated: number }
>("e2eSeed:seedAwardsFixture");

export async function seedAwardsFixture(
  fixture: ScheduleFixtureResult,
): Promise<{ winnerPlayerId: string; awardsCreated: number }> {
  const client = getSeedClient();
  return client.mutation(seedAwardsFixtureRef, {
    leagueId: fixture.leagueId,
    seasonId: fixture.seasonId,
    homeTeamId: fixture.homeTeamId,
    awayTeamId: fixture.awayTeamId,
  });
}

const seedRankingsFixtureRef = makeFunctionReference<
  "mutation",
  {
    leagueId: string;
    seasonId: string;
    homeTeamId: string;
    awayTeamId: string;
  },
  { rankingsCreated: number }
>("e2eSeed:seedRankingsFixture");

export async function seedRankingsFixture(
  fixture: ScheduleFixtureResult,
): Promise<{ rankingsCreated: number }> {
  const client = getSeedClient();
  return client.mutation(seedRankingsFixtureRef, {
    leagueId: fixture.leagueId,
    seasonId: fixture.seasonId,
    homeTeamId: fixture.homeTeamId,
    awayTeamId: fixture.awayTeamId,
  });
}

const seedNewsRecapFixtureRef = makeFunctionReference<
  "mutation",
  {
    leagueId: string;
    seasonId: string;
    homeTeamId: string;
    awayTeamId: string;
  },
  {
    incompleteSeasonId: string;
    eventsCreated: number;
    blocksCreated: number;
  }
>("e2eSeed:seedNewsRecapFixture");

export async function seedNewsRecapFixture(
  fixture: ScheduleFixtureResult,
): Promise<{
  incompleteSeasonId: string;
  eventsCreated: number;
  blocksCreated: number;
}> {
  const client = getSeedClient();
  return client.mutation(seedNewsRecapFixtureRef, {
    leagueId: fixture.leagueId,
    seasonId: fixture.seasonId,
    homeTeamId: fixture.homeTeamId,
    awayTeamId: fixture.awayTeamId,
  });
}

const seedProspectClassRef = makeFunctionReference<
  "mutation",
  any,
  { created: number; alreadyExisted: boolean }
>("e2eSeed:seedProspectClass");

/**
 * Put a recruiting class on a season (B3).
 *
 * The production path builds one in the `prospects_generated` rollover stage,
 * which needs a completed season to roll over from. Simulating one to a
 * champion just to render a board would make the recruiting spec the slowest
 * in the suite and couple it to every earlier slice; the seed routes through
 * the same Convex mutation the rollover calls, so what it produces is the real
 * thing.
 */
export async function seedProspectClass(
  seasonId: string,
  count = 4,
): Promise<{ created: number; alreadyExisted: boolean }> {
  const client = getSeedClient();
  return client.mutation(seedProspectClassRef, { seasonId, count });
}

const seedTransferCandidatesRef = makeFunctionReference<
  "mutation",
  any,
  { created: number }
>("e2eSeed:seedTransferCandidates");

/**
 * Stack a team with buried players so the transfer window has somebody in it (B4).
 *
 * The window itself is still opened through the real button and the real
 * mutation — this only guarantees the seeded likelihood roll has candidates to
 * find, so the spec is not testing whether the RNG felt generous today.
 */
export async function seedTransferCandidates(
  seasonId: string,
  teamId: string,
  count = 6,
): Promise<{ created: number }> {
  const client = getSeedClient();
  return client.mutation(seedTransferCandidatesRef, {
    seasonId,
    teamId,
    count,
  });
}

const seedRosterMoveCandidatesRef = makeFunctionReference<
  "mutation",
  any,
  { created: number }
>("e2eSeed:seedRosterMoveCandidates");

/**
 * Seed a roster with an obvious promotion in it (B5).
 *
 * A weak senior starting ahead of strong sophomores. The MOVES are still made
 * through the real buttons and the real mutations; this only guarantees the
 * panel has a decision to show, rather than depending on whatever the rollover
 * happened to generate.
 */
export async function seedRosterMoveCandidates(
  seasonId: string,
  teamId: string,
  count = 3,
): Promise<{ created: number }> {
  const client = getSeedClient();
  return client.mutation(seedRosterMoveCandidatesRef, {
    seasonId,
    teamId,
    count,
  });
}

const seedAiHeadCoachesRef = makeFunctionReference<
  "mutation",
  { leagueId: string },
  { coachesCreated: number; coachSeasonsCreated: number; teamsScanned: number }
>("e2eSeed:seedAiHeadCoaches");

export async function seedAiHeadCoachesForLeague(leagueId: string): Promise<void> {
  const client = getSeedClient();
  await client.mutation(seedAiHeadCoachesRef, { leagueId });
}

const grantCoachSkillPointsRef = makeFunctionReference<
  "mutation",
  { coachId: string; skillPoints: number },
  null
>("e2eSeed:grantCoachSkillPoints");

export async function grantCoachSkillPoints(
  coachId: string,
  skillPoints: number,
): Promise<void> {
  const client = getSeedClient();
  await client.mutation(grantCoachSkillPointsRef, { coachId, skillPoints });
}

const listCoachesByTeamRef = makeFunctionReference<
  "query",
  { teamId: string },
  Array<{ id: string }>
>("program:listCoachesByTeam");

export async function listCoachIdsForTeam(teamId: string): Promise<string[]> {
  const client = getSeedClient();
  const rows = await client.query(listCoachesByTeamRef, { teamId });
  return rows.map((row) => row.id);
}

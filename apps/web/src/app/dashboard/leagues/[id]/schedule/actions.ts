"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { schedulesStandingsV1 } from "@/lib/flags";
import {
  createFixture,
  deleteFixture,
  generateSeasonSchedule,
  getLeague,
  getLeagueOrgId,
  getFixture,
  getSeason,
  listFixturesBySeason,
  generatePlayoffBracket,
  getPlayoffBracket,
  recordGameResult,
} from "@/lib/data-api";
import type { PlayoffMatchupDto } from "@/lib/data-api";
import type { OrgContext } from "@/lib/org-context";
import { resolveOrgRole, resolveOrgContext } from "@/lib/org-context";
import { canManageRoster } from "@/lib/permissions";
import { type TeamSimProfileCache } from "@/lib/build-team-sim-profile";
import { simulateAndPersistFixture } from "@/lib/simulate-fixture";
import {
  deriveChampion,
  fixtureIdsForRound,
  isChampionshipRound,
  isStandardPlayoffTeamCount,
  minimumUnresolvedRound,
  supportsBulkPlayoffOps,
} from "@/lib/playoffs";
import {
  trackFixtureCreated,
  trackResultRecorded,
} from "@/lib/analytics";

interface CreateFixtureActionInput {
  leagueId: string;
  seasonId: string;
  homeTeamId: string;
  awayTeamId: string;
  scheduledAt: string | null;
  week: number | null;
  venue: string | null;
}

/*
 * Auth chain shared by the three schedule actions:
 *   1. flag enabled
 *   2. Clerk session present
 *   3. league visible to the user (resolveOrgContext)
 *   4. caller can manage rosters (admin or coach) of the league's org —
 *      coaches run schedules/results (WSM-000121)
 */
async function authorizeManagerAction(
  leagueId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const enabled = await schedulesStandingsV1();
  if (!enabled) return { ok: false, error: "flag_disabled" };

  const { userId } = await auth();
  if (!userId) return { ok: false, error: "unauthorized" };

  const orgContext = await resolveOrgContext(userId);
  const league = await getLeague(leagueId, orgContext).catch(() => null);
  if (!league) return { ok: false, error: "league_not_found" };

  const orgId = await getLeagueOrgId(leagueId);
  if (!orgId) return { ok: false, error: "league_not_owned" };

  const role = await resolveOrgRole(orgId, userId);
  if (!canManageRoster(role)) return { ok: false, error: "not_authorized" };

  return { ok: true };
}

/** Ensure the viewed season belongs to the authorized league before mutating. */
async function assertSeasonBelongsToLeague(
  seasonId: string,
  leagueId: string,
  orgContext: OrgContext,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const season = await getSeason(seasonId, orgContext).catch(() => null);
  if (!season) return { ok: false, error: "season_not_found" };
  if (season.leagueId !== leagueId) {
    return { ok: false, error: "season_league_mismatch" };
  }
  return { ok: true };
}

export async function createFixtureAction(
  input: CreateFixtureActionInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const guard = await authorizeManagerAction(input.leagueId);
  if (!guard.ok) return guard;

  if (input.homeTeamId === input.awayTeamId) {
    return { ok: false, error: "home_and_away_must_differ" };
  }

  const { userId } = await auth();
  if (!userId) return { ok: false, error: "unauthorized" };

  try {
    const fixture = await createFixture({
      seasonId: input.seasonId,
      homeTeamId: input.homeTeamId,
      awayTeamId: input.awayTeamId,
      scheduledAt: input.scheduledAt,
      week: input.week,
      venue: input.venue,
      actorUserId: userId,
    });
    revalidatePath(`/dashboard/leagues/${input.leagueId}/schedule`);
    revalidatePath(`/dashboard/leagues/${input.leagueId}/standings`);
    void trackFixtureCreated({
      leagueId: input.leagueId,
      seasonId: input.seasonId,
    });
    return { ok: true, id: fixture.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("season_completed")) {
      return { ok: false, error: "season_completed" };
    }
    return { ok: false, error: message };
  }
}

/*
 * Generate a round-robin schedule for the league's active season (WSM-000153).
 * `format` chooses a single round-robin (default) or a home-and-away double
 * round-robin (WSM-000162). The mutation refuses to overwrite a slate that
 * already has recorded results / live state; that surfaces here as
 * `needsConfirm` so the UI can re-call with `confirm: true`.
 */
export async function generateScheduleAction(input: {
  leagueId: string;
  seasonId: string;
  confirm?: boolean;
  format?: "single" | "double";
}): Promise<
  | { ok: true; created: number; weeks: number; teamCount: number }
  | { ok: false; needsConfirm: true }
  | { ok: false; error: string }
> {
  const guard = await authorizeManagerAction(input.leagueId);
  if (!guard.ok) return guard;

  const { userId } = await auth();
  if (!userId) return { ok: false, error: "unauthorized" };

  try {
    const res = await generateSeasonSchedule({
      seasonId: input.seasonId,
      actorUserId: userId,
      confirm: input.confirm,
      format: input.format,
    });
    revalidatePath(`/dashboard/leagues/${input.leagueId}/schedule`);
    revalidatePath(`/dashboard/leagues/${input.leagueId}/standings`);
    return { ok: true, ...res };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("schedule_has_results")) {
      return { ok: false, needsConfirm: true };
    }
    if (message.includes("season_completed")) {
      return { ok: false, error: "season_completed" };
    }
    return { ok: false, error: message };
  }
}

interface RecordResultActionInput {
  leagueId: string;
  fixtureId: string;
  homeScore: number;
  awayScore: number;
}

export async function recordGameResultAction(
  input: RecordResultActionInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const guard = await authorizeManagerAction(input.leagueId);
  if (!guard.ok) return guard;

  const { userId } = await auth();
  if (!userId) return { ok: false, error: "unauthorized" };

  if (
    !Number.isFinite(input.homeScore) ||
    !Number.isFinite(input.awayScore) ||
    input.homeScore < 0 ||
    input.awayScore < 0
  ) {
    return { ok: false, error: "invalid_score" };
  }

  try {
    await recordGameResult({
      fixtureId: input.fixtureId,
      homeScore: input.homeScore,
      awayScore: input.awayScore,
      actorUserId: userId,
    });
    revalidatePath(`/dashboard/leagues/${input.leagueId}/schedule`);
    revalidatePath(`/dashboard/leagues/${input.leagueId}/standings`);
    revalidatePath(`/leagues/${input.leagueId}/standings`);
    void trackResultRecorded({
      leagueId: input.leagueId,
      fixtureId: input.fixtureId,
      homeScore: input.homeScore,
      awayScore: input.awayScore,
    });
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("season_completed")) {
      return { ok: false, error: "season_completed" };
    }
    return { ok: false, error: message };
  }
}

interface DeleteFixtureActionInput {
  leagueId: string;
  fixtureId: string;
}

export async function deleteFixtureAction(
  input: DeleteFixtureActionInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const guard = await authorizeManagerAction(input.leagueId);
  if (!guard.ok) return guard;

  try {
    await deleteFixture(input.fixtureId);
    revalidatePath(`/dashboard/leagues/${input.leagueId}/schedule`);
    revalidatePath(`/dashboard/leagues/${input.leagueId}/standings`);
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

/*
 * Game simulation (WSM-000183) — play-by-play engine produces scores, a full
 * game log, and per-player stat lines. Sims are deterministic per fixture and
 * recorded as normal results (never overwrite a real/final game), so standings
 * + playoff advancement flow exactly as hand-entered results do.
 */

export async function simulateGameAction(input: {
  leagueId: string;
  fixtureId: string;
}): Promise<
  { ok: true; homeScore: number; awayScore: number } | { ok: false; error: string }
> {
  const guard = await authorizeManagerAction(input.leagueId);
  if (!guard.ok) return guard;

  const { userId } = await auth();
  if (!userId) return { ok: false, error: "unauthorized" };

  const fixture = await getFixture(input.fixtureId);
  if (!fixture) return { ok: false, error: "fixture_not_found" };
  if (fixture.status === "final") return { ok: false, error: "already_final" };
  if (fixture.status === "cancelled") return { ok: false, error: "cancelled" };

  const orgContext = await resolveOrgContext(userId);

  try {
    const { homeScore, awayScore } = await simulateAndPersistFixture({
      fixture,
      orgContext,
      actorUserId: userId,
      decisive: fixture.stage === "playoff",
      profileCache: new Map(),
    });
    revalidatePath(`/dashboard/leagues/${input.leagueId}/schedule`);
    revalidatePath(`/dashboard/leagues/${input.leagueId}/standings`);
    revalidatePath(`/leagues/${input.leagueId}/standings`);
    return { ok: true, homeScore, awayScore };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

const MAX_PLAYOFF_ROUNDS = 8;

function revalidateSchedulePaths(leagueId: string, includePlayoffs = false) {
  revalidatePath(`/dashboard/leagues/${leagueId}/schedule`);
  revalidatePath(`/dashboard/leagues/${leagueId}/standings`);
  revalidatePath(`/leagues/${leagueId}/standings`);
  if (includePlayoffs) {
    revalidatePath(`/dashboard/leagues/${leagueId}/playoffs`);
  }
}

/** Sim every unplayed regular-season fixture; returns how many were played. */
async function simulateUnplayedRegularSeason(
  seasonId: string,
  userId: string,
  orgContext: OrgContext,
  profileCache: TeamSimProfileCache,
): Promise<number> {
  const fixtures = await listFixturesBySeason(seasonId).catch(() => []);
  // Regular-season, unplayed games only — never overwrite real results, and
  // leave playoff games to the bracket flow.
  const unplayed = fixtures.filter(
    (f) => f.status === "scheduled" && f.stage !== "playoff",
  );
  let simulated = 0;
  for (const fixture of unplayed) {
    await simulateAndPersistFixture({
      fixture,
      orgContext,
      actorUserId: userId,
      profileCache,
      bulkStats: true,
    });
    simulated += 1;
  }
  return simulated;
}

/** Sim playoff fixtures by id; skips missing or already-final games. */
async function simulatePlayoffFixtureIds(
  seasonId: string,
  fixtureIds: string[],
  userId: string,
  orgContext: OrgContext,
  profileCache: TeamSimProfileCache,
): Promise<number> {
  if (fixtureIds.length === 0) return 0;
  const fixtures = await listFixturesBySeason(seasonId).catch(() => []);
  const byId = new Map(fixtures.map((f) => [f.id, f]));
  let simulated = 0;
  for (const fixtureId of fixtureIds) {
    const fixture = byId.get(fixtureId);
    if (
      !fixture ||
      fixture.stage !== "playoff" ||
      fixture.status !== "scheduled"
    ) {
      continue;
    }
    await simulateAndPersistFixture({
      fixture,
      orgContext,
      actorUserId: userId,
      decisive: true,
      profileCache,
      bulkStats: true,
    });
    simulated += 1;
  }
  return simulated;
}

/**
 * Advance one single-elim round: sim only unfinished fixtures in the minimum
 * unresolved round. Championship uses {@link simulateChampionshipAction}.
 */
async function simulateCurrentPlayoffRound(
  seasonId: string,
  userId: string,
  orgContext: OrgContext,
  profileCache: TeamSimProfileCache,
): Promise<
  | { ok: true; simulated: number; round: number | null }
  | { ok: false; error: string }
> {
  const bracket = await getPlayoffBracket(seasonId).catch(() => null);
  if (!bracket || bracket.matchups.length === 0) {
    return { ok: false, error: "no_playoffs" };
  }
  if (!supportsBulkPlayoffOps(bracket.format)) {
    return { ok: false, error: "unsupported_format" };
  }

  const round = minimumUnresolvedRound(bracket.matchups, bracket.rounds);
  if (round === null) {
    return { ok: true, simulated: 0, round: null };
  }
  if (isChampionshipRound(round, bracket.rounds)) {
    return { ok: false, error: "championship_requires_explicit_sim" };
  }

  const fixtureIds = fixtureIdsForRound(bracket.matchups, round);
  const simulated = await simulatePlayoffFixtureIds(
    seasonId,
    fixtureIds,
    userId,
    orgContext,
    profileCache,
  );
  return { ok: true, simulated, round };
}

/**
 * Sim every unplayed winners-bracket round through semifinal; leaves the
 * championship fixture unresolved (WSM-000241).
 */
async function simulatePlayoffsThroughSemifinal(
  seasonId: string,
  userId: string,
  orgContext: OrgContext,
  profileCache: TeamSimProfileCache,
): Promise<number> {
  let playoffGames = 0;
  for (let safety = 0; safety < MAX_PLAYOFF_ROUNDS; safety++) {
    const bracket = await getPlayoffBracket(seasonId).catch(() => null);
    if (!bracket || bracket.matchups.length === 0) break;
    if (!supportsBulkPlayoffOps(bracket.format)) break;

    const round = minimumUnresolvedRound(bracket.matchups, bracket.rounds);
    if (round === null) break;
    if (isChampionshipRound(round, bracket.rounds)) break;

    const simulated = await simulatePlayoffFixtureIds(
      seasonId,
      fixtureIdsForRound(bracket.matchups, round),
      userId,
      orgContext,
      profileCache,
    );
    playoffGames += simulated;
    if (simulated === 0) break;
  }
  return playoffGames;
}

/** Sim every unplayed playoff round through a champion (whole-season path). */
async function simulateAllPlayoffRounds(
  seasonId: string,
  userId: string,
  orgContext: OrgContext,
  profileCache: TeamSimProfileCache,
): Promise<number> {
  let playoffGames = 0;
  for (let safety = 0; safety < MAX_PLAYOFF_ROUNDS; safety++) {
    const bracket = await getPlayoffBracket(seasonId).catch(() => null);
    if (!bracket || bracket.matchups.length === 0) break;

    const round = minimumUnresolvedRound(bracket.matchups, bracket.rounds);
    if (round === null) break;

    const simulated = await simulatePlayoffFixtureIds(
      seasonId,
      fixtureIdsForRound(bracket.matchups, round),
      userId,
      orgContext,
      profileCache,
    );
    playoffGames += simulated;
    if (simulated === 0) break;
  }
  return playoffGames;
}

/** Sim only the championship (final) matchup(s). */
async function simulateChampionshipFixtures(
  seasonId: string,
  userId: string,
  orgContext: OrgContext,
  profileCache: TeamSimProfileCache,
): Promise<
  | { ok: true; simulated: number }
  | { ok: false; error: string }
> {
  const bracket = await getPlayoffBracket(seasonId).catch(() => null);
  if (!bracket || bracket.matchups.length === 0) {
    return { ok: false, error: "no_playoffs" };
  }
  if (!supportsBulkPlayoffOps(bracket.format)) {
    return { ok: false, error: "unsupported_format" };
  }

  const finalRound = bracket.rounds;
  const fixtureIds = fixtureIdsForRound(bracket.matchups, finalRound);
  if (fixtureIds.length === 0) {
    return { ok: false, error: "no_championship_fixture" };
  }

  const simulated = await simulatePlayoffFixtureIds(
    seasonId,
    fixtureIds,
    userId,
    orgContext,
    profileCache,
  );
  return { ok: true, simulated };
}

function championFromBracket(
  bracket: { matchups: PlayoffMatchupDto[]; format: string } | null,
): string | null {
  if (!bracket) return null;
  const champion = deriveChampion(bracket.matchups, bracket.format);
  return champion?.teamName ?? null;
}

export async function simulateWeekAction(input: {
  leagueId: string;
  seasonId: string;
  week: number;
}): Promise<{ ok: true; simulated: number } | { ok: false; error: string }> {
  const guard = await authorizeManagerAction(input.leagueId);
  if (!guard.ok) return guard;

  const { userId } = await auth();
  if (!userId) return { ok: false, error: "unauthorized" };

  const orgContext = await resolveOrgContext(userId);
  const profileCache: TeamSimProfileCache = new Map();
  try {
    const fixtures = await listFixturesBySeason(input.seasonId).catch(() => []);
    const unplayed = fixtures.filter(
      (f) => f.status === "scheduled" && f.week === input.week,
    );
    let simulated = 0;
    for (const fixture of unplayed) {
      await simulateAndPersistFixture({
        fixture,
        orgContext,
        actorUserId: userId,
        decisive: fixture.stage === "playoff",
        profileCache,
        bulkStats: true,
      });
      simulated += 1;
    }
    revalidateSchedulePaths(input.leagueId);
    return { ok: true, simulated };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

export async function simulateRegularSeasonAction(input: {
  leagueId: string;
  seasonId: string;
}): Promise<{ ok: true; simulated: number } | { ok: false; error: string }> {
  const guard = await authorizeManagerAction(input.leagueId);
  if (!guard.ok) return guard;

  const { userId } = await auth();
  if (!userId) return { ok: false, error: "unauthorized" };

  const orgContext = await resolveOrgContext(userId);
  try {
    const simulated = await simulateUnplayedRegularSeason(
      input.seasonId,
      userId,
      orgContext,
      new Map(),
    );
    revalidateSchedulePaths(input.leagueId);
    return { ok: true, simulated };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

/** Legacy label — same scope as {@link simulateRegularSeasonAction}. */
export async function simulateSeasonAction(input: {
  leagueId: string;
  seasonId: string;
}): Promise<{ ok: true; simulated: number } | { ok: false; error: string }> {
  return simulateRegularSeasonAction(input);
}

export async function simulatePlayoffsAction(input: {
  leagueId: string;
  seasonId: string;
}): Promise<
  | { ok: true; playoffGames: number; champion: string | null }
  | { ok: false; error: string }
> {
  const guard = await authorizeManagerAction(input.leagueId);
  if (!guard.ok) return guard;

  const { userId } = await auth();
  if (!userId) return { ok: false, error: "unauthorized" };

  const orgContext = await resolveOrgContext(userId);
  const seasonGuard = await assertSeasonBelongsToLeague(
    input.seasonId,
    input.leagueId,
    orgContext,
  );
  if (!seasonGuard.ok) return seasonGuard;

  const bracket = await getPlayoffBracket(input.seasonId).catch(() => null);
  if (!bracket || bracket.matchups.length === 0) {
    return { ok: false, error: "no_playoffs" };
  }
  if (!supportsBulkPlayoffOps(bracket.format)) {
    return { ok: false, error: "unsupported_format" };
  }

  const profileCache: TeamSimProfileCache = new Map();
  try {
    const playoffGames = await simulatePlayoffsThroughSemifinal(
      input.seasonId,
      userId,
      orgContext,
      profileCache,
    );
    const updatedBracket = await getPlayoffBracket(input.seasonId).catch(
      () => null,
    );
    const champion = championFromBracket(updatedBracket);
    revalidateSchedulePaths(input.leagueId, true);
    return { ok: true, playoffGames, champion };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

/** Simulate unfinished games in the current single-elim round only (WSM-000241). */
export async function advancePlayoffRoundAction(input: {
  leagueId: string;
  seasonId: string;
}): Promise<
  | { ok: true; simulated: number; round: number | null }
  | { ok: false; error: string }
> {
  const guard = await authorizeManagerAction(input.leagueId);
  if (!guard.ok) return guard;

  const { userId } = await auth();
  if (!userId) return { ok: false, error: "unauthorized" };

  const orgContext = await resolveOrgContext(userId);
  const seasonGuard = await assertSeasonBelongsToLeague(
    input.seasonId,
    input.leagueId,
    orgContext,
  );
  if (!seasonGuard.ok) return seasonGuard;

  const profileCache: TeamSimProfileCache = new Map();
  try {
    const res = await simulateCurrentPlayoffRound(
      input.seasonId,
      userId,
      orgContext,
      profileCache,
    );
    if (!res.ok) return res;
    revalidateSchedulePaths(input.leagueId, true);
    return res;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

/** Simulate only the championship (final) matchup (WSM-000241). */
export async function simulateChampionshipAction(input: {
  leagueId: string;
  seasonId: string;
}): Promise<
  | { ok: true; simulated: number; champion: string | null }
  | { ok: false; error: string }
> {
  const guard = await authorizeManagerAction(input.leagueId);
  if (!guard.ok) return guard;

  const { userId } = await auth();
  if (!userId) return { ok: false, error: "unauthorized" };

  const orgContext = await resolveOrgContext(userId);
  const seasonGuard = await assertSeasonBelongsToLeague(
    input.seasonId,
    input.leagueId,
    orgContext,
  );
  if (!seasonGuard.ok) return seasonGuard;

  const profileCache: TeamSimProfileCache = new Map();
  try {
    const res = await simulateChampionshipFixtures(
      input.seasonId,
      userId,
      orgContext,
      profileCache,
    );
    if (!res.ok) return res;
    const bracket = await getPlayoffBracket(input.seasonId).catch(() => null);
    const champion = championFromBracket(bracket);
    revalidateSchedulePaths(input.leagueId, true);
    return { ok: true, simulated: res.simulated, champion };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

/*
 * Simulate a whole season through to a champion (WSM-000185): sim every unplayed
 * regular-season game, then — if the season is configured for playoffs —
 * (re)generate the bracket from its config and sim each playoff round until a
 * winner emerges. Single-elim + standard 4/8/16 only (WSM-000241); double-elim
 * and legacy sizes are rejected. Bounded loop (≤ 8 rounds) as a safety net.
 */
export async function simulateSeasonThroughChampionAction(input: {
  leagueId: string;
  seasonId: string;
}): Promise<
  | {
      ok: true;
      regularSimulated: number;
      playoffGames: number;
      champion: string | null;
    }
  | { ok: false; error: string }
> {
  const guard = await authorizeManagerAction(input.leagueId);
  if (!guard.ok) return guard;

  const { userId } = await auth();
  if (!userId) return { ok: false, error: "unauthorized" };

  const orgContext = await resolveOrgContext(userId);
  const seasonGuard = await assertSeasonBelongsToLeague(
    input.seasonId,
    input.leagueId,
    orgContext,
  );
  if (!seasonGuard.ok) return seasonGuard;

  const profileCache: TeamSimProfileCache = new Map();
  try {
    const season = await getSeason(input.seasonId, orgContext).catch(() => null);
    const size = season?.playoffTeams ?? 0;

    // Validate playoff config before mutating any fixtures so rejected
    // requests are side-effect free (WSM-000241).
    if (season && size) {
      if (!isStandardPlayoffTeamCount(size)) {
        return { ok: false, error: "invalid_playoff_size" };
      }
      if ((season.playoffFormat ?? "single") === "double") {
        return { ok: false, error: "unsupported_format" };
      }
    }

    const regularSimulated = await simulateUnplayedRegularSeason(
      input.seasonId,
      userId,
      orgContext,
      profileCache,
    );

    if (!season || !size) {
      // No playoffs configured — regular season is the whole story.
      revalidateSchedulePaths(input.leagueId);
      return { ok: true, regularSimulated, playoffGames: 0, champion: null };
    }

    // Fresh bracket from the configured size + qualification rule.
    await generatePlayoffBracket({
      seasonId: input.seasonId,
      size,
      actorUserId: userId,
      confirm: true,
      divisionWinnersQualify: season.divisionWinnersQualify,
    });

    const playoffGames = await simulateAllPlayoffRounds(
      input.seasonId,
      userId,
      orgContext,
      profileCache,
    );

    const bracket = await getPlayoffBracket(input.seasonId).catch(() => null);
    const champion = championFromBracket(bracket);

    revalidateSchedulePaths(input.leagueId, true);
    return { ok: true, regularSimulated, playoffGames, champion };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

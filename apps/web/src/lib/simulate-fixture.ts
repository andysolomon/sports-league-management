import type { FixtureDto } from "@sports-management/shared-types";
import {
  bulkUpsertPlayerGameStats,
  recordGameInjuries,
  recordGameResult,
  upsertGamePlayLog,
  upsertPlayerGameStats,
} from "@/lib/data-api";
import {
  buildTeamSimProfile,
  type TeamSimProfileCache,
} from "@/lib/build-team-sim-profile";
import type { OrgContext } from "@/lib/org-context";
import {
  deriveStatLines,
  PBP_ENGINE_VERSION,
  simulateGameLog,
} from "@/lib/pbp";
import { seedFromString, simulateScore } from "@/lib/simulate-game";
import {
  DEFAULT_SIMULATION_FLAVOR,
  type SimulationFlavor,
} from "@/lib/simulation-flavor";
import {
  applyTeamProgram,
  fixtureSimConditions,
  type SeasonSimContext,
} from "@/lib/sim-context";

export interface SimulateFixtureInput {
  fixture: FixtureDto;
  orgContext: OrgContext;
  actorUserId: string;
  decisive?: boolean;
  profileCache: TeamSimProfileCache;
  /** When true, stat lines are written in one bulk mutation (season sims). */
  bulkStats?: boolean;
  /** Season simulation flavor (defaults to balanced). */
  simulationFlavor?: SimulationFlavor;
  /**
   * What this run is allowed to model, resolved once by the caller.
   *
   * REQUIRED rather than optional on purpose. An optional field defaulting to
   * "no mechanics" is exactly how four slices ended up shipping dark without
   * anyone noticing — a new call site would silently simulate v1 games. Making
   * it required means `tsc` forces every caller to decide.
   */
  simContext: SeasonSimContext;
}

export interface SimulateFixtureResult {
  homeScore: number;
  awayScore: number;
  /** True when either team had no roster players — score-only fallback. */
  usedScoreFallback: boolean;
}

function knownPlayerIds(
  homePlayers: { playerId: string }[],
  awayPlayers: { playerId: string }[],
): Set<string> {
  return new Set([
    ...homePlayers.map((p) => p.playerId),
    ...awayPlayers.map((p) => p.playerId),
  ]);
}

/**
 * Run PBP sim (or score fallback), persist the log + stat lines, and record
 * the final score. Playoff bracket advancement stays in recordGameResult.
 */
export async function simulateAndPersistFixture(
  input: SimulateFixtureInput,
): Promise<SimulateFixtureResult> {
  const { fixture, orgContext, actorUserId, profileCache } = input;
  const decisive = input.decisive ?? fixture.stage === "playoff";
  const flavor = input.simulationFlavor ?? DEFAULT_SIMULATION_FLAVOR;
  const seed = seedFromString(fixture.id);

  const [home, away] = await Promise.all([
    buildTeamSimProfile(fixture.homeTeamId, fixture.seasonId, orgContext, profileCache),
    buildTeamSimProfile(fixture.awayTeamId, fixture.seasonId, orgContext, profileCache),
  ]);

  /*
   * Bench anyone still serving an injury (A4).
   *
   * Filtered HERE rather than inside `buildTeamSimProfile` because that is
   * cached per (team, season) and the unavailable set belongs to the run. A
   * cached profile that had already dropped an injured player would keep
   * dropping him after he healed.
   */
  const unavailable = input.simContext.unavailablePlayerIds;
  const fit = (team: typeof home) =>
    unavailable.size === 0
      ? team
      : { ...team, players: team.players.filter((p) => !unavailable.has(p.playerId)) };
  /*
   * Schemes ride on the profile for the same reason injuries do not ride in
   * the cache: what a team runs belongs to the season, but the CACHE is keyed
   * on (team, season) and shared across runs, and a commissioner can change a
   * scheme between two simulations of the same season.
   */
  const homeFit = applyTeamProgram(fit(home), input.simContext);
  const awayFit = applyTeamProgram(fit(away), input.simContext);

  const rosterEmpty =
    homeFit.players.length === 0 || awayFit.players.length === 0;

  if (rosterEmpty) {
    const { homeScore, awayScore } = simulateScore({
      homeStrength: homeFit.strength,
      awayStrength: awayFit.strength,
      seed,
      decisive,
      flavor,
    });
    await recordGameResult({
      fixtureId: fixture.id,
      homeScore,
      awayScore,
      actorUserId,
    });
    return { homeScore, awayScore, usedScoreFallback: true };
  }

  /*
   * The score-only fallback above never reaches here, which matters: a game
   * with no rosters has no plays to apply penalties or weather to, so it is
   * correctly recorded with no gates rather than with gates that did nothing.
   */
  const conditions = fixtureSimConditions(input.simContext, fixture);
  const log = simulateGameLog({
    home: homeFit,
    away: awayFit,
    seed,
    decisive,
    flavor,
    features: input.simContext.features,
    injurySeverityScale: input.simContext.injurySeverityScale,
    ...conditions,
  });
  const homeScore = log.homeScore;
  const awayScore = log.awayScore;

  await upsertGamePlayLog({
    fixtureId: fixture.id,
    seasonId: fixture.seasonId,
    logJson: JSON.stringify(log),
    engineVersion: PBP_ENGINE_VERSION,
    actorUserId,
  });

  /*
   * Injuries are persisted BEFORE the result is recorded, so a failure leaves a
   * game that has not been marked final — which the sim will retry — rather
   * than a final game whose injuries were lost.
   */
  if (log.injuries !== undefined) {
    await recordGameInjuries({
      fixtureId: fixture.id,
      seasonId: fixture.seasonId,
      leagueId: input.simContext.leagueId,
      week: fixture.week,
      homeTeamId: fixture.homeTeamId,
      awayTeamId: fixture.awayTeamId,
      injuries: log.injuries.map((injury) => ({
        playerId: injury.playerId,
        teamId: injury.teamId,
        severity: injury.severity,
        label: injury.label,
        gamesOut: injury.gamesOut,
      })),
    }).catch(() => null);
  }

  const rosterIds = knownPlayerIds(homeFit.players, awayFit.players);
  const statLines = deriveStatLines(log).filter((line) =>
    rosterIds.has(line.playerId),
  );

  if (statLines.length > 0) {
    if (input.bulkStats) {
      await bulkUpsertPlayerGameStats({
        fixtureId: fixture.id,
        seasonId: fixture.seasonId,
        actorUserId,
        lines: statLines.map((line) => ({
          playerId: line.playerId,
          teamId: line.teamId,
          statsJson: JSON.stringify(line.statLine),
        })),
      });
    } else {
      await Promise.all(
        statLines.map((line) =>
          upsertPlayerGameStats({
            fixtureId: fixture.id,
            seasonId: fixture.seasonId,
            playerId: line.playerId,
            teamId: line.teamId,
            stats: line.statLine,
            actorUserId,
          }),
        ),
      );
    }
  }

  await recordGameResult({
    fixtureId: fixture.id,
    homeScore,
    awayScore,
    actorUserId,
  });

  return { homeScore, awayScore, usedScoreFallback: false };
}

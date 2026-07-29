import {
  getDynastyConfig,
  listActiveInjuries,
  listCoachesByLeague,
  listRivalries,
  listTeamPrograms,
} from "@/lib/data-api";
import type { DynastyConfig } from "@/lib/dynasty-config";
import type { PbpFeatureGates, TeamSimProfile } from "@/lib/pbp";
import { deriveWeather, type Weather } from "@/lib/pbp/weather";
import { rivalryPairKey } from "@/lib/rivalries";
import { COACH_ROLE_HEAD } from "@/lib/program/coach";
import { resolveAggression } from "@/lib/program/resolveProgram";

/*
 * What a simulated game is allowed to model (Dynasty Mode — sim activation).
 *
 * Two independent switches, and they answer different questions:
 *
 * - The FEATURE FLAG (`FLAG_DYNASTY_SIM_V2`) asks "has this deployment shipped
 *   Epic A?" It is per-environment and controlled by us.
 * - The per-league CONFIG asks "does this league want this mechanic?" It is
 *   runtime-toggleable by a commissioner and needs no deploy.
 *
 * The flag is the outer gate: with it off, no league gets v2 mechanics no
 * matter what they have configured. That ordering is what makes the flag a
 * usable kill switch — one env var turns the whole epic off for everyone,
 * without touching a single league's settings, and turning it back on restores
 * exactly what each league had chosen.
 */

/** Everything a run of the simulator needs beyond the fixtures themselves. */
export interface SeasonSimContext {
  leagueId: string;
  /** Resolved once per run — every fixture in the run simulates alike. */
  features: PbpFeatureGates;
  /** `pairKey` → intensity, for the rivalry lookup (A5). */
  rivalries: ReadonlyMap<string, number>;
  /** League injury dial, 0–2 (A4). */
  injurySeverityScale: number;
  /**
   * Players who cannot play (A4), resolved once for the run.
   *
   * Read per season rather than per team: one indexed query answers for every
   * fixture in the run, where a per-team read would be two more reads a game.
   */
  unavailablePlayerIds: ReadonlySet<string>;
  /**
   * `teamId` → what that team runs (A6), for every team with a program row.
   *
   * Loaded once per run for the same reason as the injuries above: a season
   * simulation plays every fixture in a loop, and a scheme cannot change
   * between two games in one run.
   *
   * A team missing from this map has stated no scheme, which the engine reads
   * as the identity transform — not as an average.
   */
  schemes: ReadonlyMap<string, TeamSchemeAssignment>;
}

/** What one team runs, as the engine consumes it. */
export type TeamSchemeAssignment = NonNullable<TeamSimProfile["scheme"]> & {
  /** 0–100 coach 4th-down dial, when the program sets one. */
  aggression?: number;
};

/**
 * Map a league's settings onto engine gates.
 *
 * Pure, and the single place the mapping exists. `flagEnabled: false` produces
 * NO gates at all rather than the league's preferences — the flag is the outer
 * gate, not one vote among several.
 */
export function resolveSimFeatures(
  flagEnabled: boolean,
  config: DynastyConfig,
): PbpFeatureGates {
  if (!flagEnabled) return {};

  /*
   * Only gates that are ON are set. An explicit `false` and an absent key mean
   * the same thing to the engine, and recording the difference on the log
   * would imply the engine considered a mechanic and declined — see
   * `activeFeatures` in `pbp/engine.ts`.
   */
  const features: PbpFeatureGates = {};
  if (config.scoringDepthEnabled) features.scoringV2 = true;
  if (config.penaltiesEnabled) features.penalties = true;
  if (config.situationalAiEnabled) features.situational = true;
  if (config.balanceTuningEnabled) features.balance = true;
  if (config.weatherEnabled) features.weather = true;
  if (config.injuriesEnabled) features.injuries = true;
  if (config.schemesEnabled) features.schemes = true;
  return features;
}

/**
 * Load the league's settings and rivalries once for a whole run.
 *
 * A season simulation plays every fixture in a loop. Reading config and
 * rivalries per fixture would be a read per game for data that cannot change
 * mid-run — the same N+1 shape F2 and F3 were built to remove.
 *
 * Fails soft: a league whose settings cannot be read simulates with no v2
 * mechanics rather than failing the whole run. A missed mechanic is a worse
 * game; a thrown error is no game.
 */
export async function loadSeasonSimContext(input: {
  leagueId: string;
  seasonId: string;
  flagEnabled: boolean;
}): Promise<SeasonSimContext> {
  const [config, rivalries, injuries, programs, coaches] = await Promise.all([
    getDynastyConfig(input.leagueId).catch(() => null),
    listRivalries(input.leagueId).catch(() => []),
    listActiveInjuries(input.seasonId).catch(() => []),
    listTeamPrograms(input.seasonId).catch(() => []),
    listCoachesByLeague(input.leagueId).catch(() => []),
  ]);

  const features = config ? resolveSimFeatures(input.flagEnabled, config) : {};
  const coachAggressionByTeam = new Map(
    coaches
      .filter((c) => c.teamId && c.role === COACH_ROLE_HEAD)
      .map((c) => [c.teamId as string, c.aggression]),
  );
  return {
    leagueId: input.leagueId,
    features,
    injurySeverityScale: config?.injurySeverityScale ?? 1,
    rivalries: new Map(
      rivalries.map((r) => [rivalryPairKey(r.teamAId, r.teamBId), r.intensity]),
    ),
    /*
     * Only benches anyone when the gate is on. With injuries disabled a stored
     * injury is history, not a rule — a league that switches the mechanic off
     * mid-season gets everyone back rather than carrying invisible absences.
     */
    unavailablePlayerIds: new Set(
      features.injuries === true ? injuries.map((i) => i.playerId) : [],
    ),
    /*
     * Only populated when the gate is on. With schemes disabled a stored
     * assignment is a preference nobody is acting on — the same rule the
     * injuries above follow, and the reason flipping the knob off restores
     * pre-A6 play rather than leaving a hidden effect behind.
     *
     * `aggression` rides along here rather than in a second map: it comes from
     * the same row and is read at the same moment, and splitting it would mean
     * two lookups per team for one document.
     */
    schemes: new Map(
      features.schemes === true
        ? programs.map((p) => {
            const aggression = resolveAggression(
              coachAggressionByTeam.get(p.teamId ?? "") ?? null,
              p.aggression,
            );
            return [
              p.teamId,
              {
                ...(p.offenseScheme !== null ? { offense: p.offenseScheme } : {}),
                ...(p.defenseScheme !== null ? { defense: p.defenseScheme } : {}),
                ...(p.tempo !== null ? { tempo: p.tempo } : {}),
                ...(p.blitzRate !== null ? { blitzRate: p.blitzRate } : {}),
                ...(typeof aggression === "number" ? { aggression } : {}),
              } satisfies TeamSchemeAssignment,
            ];
          })
        : [],
    ),
  };
}

/** A context that models nothing — for callers with no league in hand. */
export function emptySimContext(leagueId: string): SeasonSimContext {
  return {
    leagueId,
    features: {},
    rivalries: new Map(),
    injurySeverityScale: 1,
    unavailablePlayerIds: new Set(),
    schemes: new Map(),
  };
}

/**
 * Apply a team's scheme and coach dials to its sim profile.
 *
 * Returns the profile UNCHANGED when the team has no program — object identity
 * included. A caller that has assigned nothing must not end up with a profile
 * carrying an empty `scheme` object, because `{}` and absence would then have
 * to mean the same thing in two places instead of one.
 */
export function applyTeamProgram(
  profile: TeamSimProfile,
  context: SeasonSimContext,
): TeamSimProfile {
  const assignment = context.schemes.get(profile.teamId);
  if (!assignment) return profile;

  const { aggression, ...scheme } = assignment;
  const next: TeamSimProfile = { ...profile };
  if (Object.keys(scheme).length > 0) next.scheme = scheme;
  if (typeof aggression === "number") {
    next.coach = { ...profile.coach, aggression };
  }
  return next;
}

export interface FixtureSimConditions {
  weather?: Weather;
  rivalryIntensity?: number;
}

/**
 * Per-fixture conditions derived from the run context.
 *
 * Weather is derived rather than stored, and only when the gate is on. Deriving
 * it with the gate off would be harmless (the engine ignores it) but
 * misleading: the log records what it was given, and a value the game did not
 * simulate under has no business being computed here.
 *
 * A fixture with no week cannot have weather — week is what places the game in
 * the season's calendar, and guessing one would invent a climate.
 */
export function fixtureSimConditions(
  context: SeasonSimContext,
  fixture: { seasonId: string; week: number | null; homeTeamId: string; awayTeamId: string },
): FixtureSimConditions {
  const conditions: FixtureSimConditions = {};

  if (context.features.weather === true && fixture.week !== null) {
    conditions.weather = deriveWeather({
      seasonId: fixture.seasonId,
      week: fixture.week,
      // A program plays its home games in one climate, so the home team is the
      // venue. Same choice the schedule's forecast chip makes, which is what
      // makes the two agree.
      venueId: fixture.homeTeamId,
    });
  }

  const intensity = context.rivalries.get(
    rivalryPairKey(fixture.homeTeamId, fixture.awayTeamId),
  );
  if (intensity !== undefined) conditions.rivalryIntensity = intensity;

  return conditions;
}

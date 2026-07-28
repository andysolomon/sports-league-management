import { getDynastyConfig, listRivalries } from "@/lib/data-api";
import type { DynastyConfig } from "@/lib/dynasty-config";
import type { PbpFeatureGates } from "@/lib/pbp";
import { deriveWeather, type Weather } from "@/lib/pbp/weather";
import { rivalryPairKey } from "@/lib/rivalries";

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
}

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
  flagEnabled: boolean;
}): Promise<SeasonSimContext> {
  const [config, rivalries] = await Promise.all([
    getDynastyConfig(input.leagueId).catch(() => null),
    listRivalries(input.leagueId).catch(() => []),
  ]);

  return {
    leagueId: input.leagueId,
    features: config ? resolveSimFeatures(input.flagEnabled, config) : {},
    rivalries: new Map(
      rivalries.map((r) => [rivalryPairKey(r.teamAId, r.teamBId), r.intensity]),
    ),
  };
}

/** A context that models nothing — for callers with no league in hand. */
export function emptySimContext(leagueId: string): SeasonSimContext {
  return { leagueId, features: {}, rivalries: new Map() };
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

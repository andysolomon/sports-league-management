/*
 * Game-score simulator (WSM-000183) — produces believable football scores for
 * an unplayed fixture, weighted by relative team strength so stronger rosters
 * win more often (but upsets still happen). Pure + deterministic given a seed,
 * so a fixture always sims the same way and the lib is unit-testable.
 *
 * Team "strength" is a 0–99 aggregate (mean of the roster's SPRT/Madden
 * `weightedOverall`); 50 is a neutral/unrated team. The score model: each side's
 * expected points start at a league-average baseline, shift with the strength
 * differential, get a small home-field bump, then add seeded variance — enough
 * that a clearly stronger team usually (not always) wins.
 */
import { seedFromString } from "@/lib/synthetic-roster";
import {
  DEFAULT_SIMULATION_FLAVOR,
  normalizeSimulationFlavor,
  weightsForFlavor,
  type SimulationFlavor,
} from "@/lib/simulation-flavor";

/** Average points an average matchup yields per team. */
const BASELINE_POINTS = 21;
/** Home-field edge, in points. */
const HOME_FIELD = 2.5;

/** mulberry32 — small deterministic PRNG (same family as synthetic-roster). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rng(seed: number): () => number {
  return mulberry32(seed);
}

export interface SimulateScoreInput {
  /** Home team strength, ~0–99 (50 = neutral). */
  homeStrength: number;
  /** Away team strength, ~0–99. */
  awayStrength: number;
  /** Deterministic seed (e.g. seedFromString(fixtureId)). */
  seed: number;
  /** When true, never returns a tie — re-rolls to a clean winner (playoffs). */
  decisive?: boolean;
  /** Season simulation flavor; `balanced` preserves legacy weighting. */
  flavor?: SimulationFlavor;
}

export interface SimulatedScore {
  homeScore: number;
  awayScore: number;
}

function pointsFor(
  strength: number,
  oppStrength: number,
  homeEdge: number,
  rand: () => number,
  strengthWeight: number,
  variance: number,
): number {
  const base =
    BASELINE_POINTS + (strength - oppStrength) * strengthWeight + homeEdge;
  const swing = (rand() - 0.5) * 2 * variance;
  return Math.max(0, Math.round(base + swing));
}

/**
 * Simulate a final score. Deterministic for a given seed. When `decisive` is
 * set (playoff games), a tie is broken by nudging the stronger team (or home on
 * an exact strength tie) ahead, so the bracket always advances.
 */
export function simulateScore({
  homeStrength,
  awayStrength,
  seed,
  decisive = false,
  flavor = DEFAULT_SIMULATION_FLAVOR,
}: SimulateScoreInput): SimulatedScore {
  const weights = weightsForFlavor(normalizeSimulationFlavor(flavor));
  const rand = rng(seed);
  let homeScore = pointsFor(
    homeStrength,
    awayStrength,
    HOME_FIELD,
    rand,
    weights.strengthWeight,
    weights.variance,
  );
  let awayScore = pointsFor(
    awayStrength,
    homeStrength,
    0,
    rand,
    weights.strengthWeight,
    weights.variance,
  );

  if (decisive && homeScore === awayScore) {
    // Overtime field goal for the favorite (home wins an exact-strength tie).
    if (awayStrength > homeStrength) awayScore += 3;
    else homeScore += 3;
  }

  return { homeScore, awayScore };
}

export { seedFromString };

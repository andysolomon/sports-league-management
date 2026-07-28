/*
 * Crowd, venue and rivalry (Dynasty Mode A5).
 *
 * Pure, deterministic, and — like `situational.ts` — it draws no random number.
 * Home-field advantage is a property of the matchup, not a die roll.
 *
 * ## The contract that keeps this safe to add
 *
 * `homeFieldEdge` with neutral inputs returns the base edge EXACTLY. Venue
 * prestige is an optional input that stays neutral until Epic C2 ships
 * `teamSeasonPrograms`, and rivalry intensity is zero for every pair nobody has
 * declared a rivalry for — which is almost all of them. So the common case is
 * the identity, and enabling this slice cannot silently re-tune a league that
 * has configured nothing.
 */

/** Prestige with no program data behind it. Returns the base edge unchanged. */
export const NEUTRAL_PRESTIGE = 50;

export interface HomeFieldEdgeInput {
  /**
   * The engine's own home-field constant, already resolved for the `balance`
   * gate. This module scales it; it does not own it.
   */
  base: number;
  /**
   * 0-100 venue/program prestige. Absent or 50 is neutral. A blue-blood
   * program in a full stadium is worth more than an empty one.
   */
  venuePrestige?: number;
  /**
   * 0-100 rivalry intensity for this specific pairing, 0 when the teams are not
   * rivals.
   */
  rivalryIntensity?: number;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/**
 * The home team's edge for this matchup.
 *
 * Prestige scales the edge multiplicatively — a loud, storied venue amplifies
 * whatever home field is already worth. Rivalry works the OTHER way and damps
 * it: a rivalry game is the one night a year the visitors travel well and
 * nobody is intimidated. That is the interesting behavior, and it is why
 * rivalry is not just "more home field".
 */
export function homeFieldEdge(input: HomeFieldEdgeInput): number {
  const prestige = input.venuePrestige ?? NEUTRAL_PRESTIGE;
  const rivalry = clamp(input.rivalryIntensity ?? 0, 0, 100);

  const prestigeScale = 1 + (clamp(prestige, 0, 100) - NEUTRAL_PRESTIGE) / 125;
  const rivalryScale = 1 - (rivalry / 100) * 0.6;

  return input.base * prestigeScale * rivalryScale;
}

/**
 * Does this matchup carry extra weight?
 *
 * Used for narrative and UI, not for play outcomes — a rivalry badge on a
 * fixture is worth showing even when the intensity is low enough that the edge
 * barely moves.
 */
export function isRivalry(rivalryIntensity: number | undefined): boolean {
  return typeof rivalryIntensity === "number" && rivalryIntensity > 0;
}

/*
 * The pair key is defined in `convex/lib/rivalries.ts` and re-exported here
 * rather than reimplemented. The database deduplicates rivalries on this key
 * and the engine looks them up with it — if the two ever drifted, a declared
 * rivalry would silently stop being found at simulation time.
 */
export { rivalryPairKey } from "@/lib/rivalries";

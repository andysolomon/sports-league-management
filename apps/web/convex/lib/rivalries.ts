/*
 * Rivalry pairing rules (Dynasty Mode A5) — shared shape and key derivation.
 *
 * CANONICAL, and it lives under `convex/` for the same reason
 * `convex/lib/dynastyConfig.ts` does: the Convex bundler can only reach files
 * in this directory, while `src/` can reach both. `src/lib/pbp/crowd.ts`
 * re-exports `rivalryPairKey` rather than reimplementing it, so the key the
 * database deduplicates on and the key the engine looks up with cannot drift.
 *
 * That drift is the whole risk here. If the two sides ever disagreed about how
 * a pair is keyed, a declared rivalry would simply stop being found at
 * simulation time — silently, with no error, and only visible as "the rivalry
 * setting does nothing".
 *
 * No Convex imports: this module must stay importable from the Next bundle.
 */

/** Bounds for a rivalry's intensity. */
export const RIVALRY_INTENSITY_MIN = 1;
export const RIVALRY_INTENSITY_MAX = 100;
export const RIVALRY_INTENSITY_DEFAULT = 60;

/**
 * Canonical key for an unordered team pair.
 *
 * A rivalry is symmetric, so the ids are sorted before joining: "A vs B" and
 * "B vs A" produce the same key and therefore the same row.
 */
export function rivalryPairKey(teamIdA: string, teamIdB: string): string {
  return [teamIdA, teamIdB].sort().join("|");
}

/** The two ids in the same order `pairKey` puts them. */
export function sortRivalryTeams(
  teamIdA: string,
  teamIdB: string,
): [string, string] {
  return [teamIdA, teamIdB].sort() as [string, string];
}

/**
 * Clamp an intensity into range.
 *
 * A rivalry with intensity 0 is not a rivalry — it would be a row that changes
 * nothing, which is worse than no row because it looks configured. The minimum
 * is 1, and callers delete rather than zero.
 */
export function normalizeIntensity(value: number): number {
  if (!Number.isFinite(value)) return RIVALRY_INTENSITY_DEFAULT;
  return Math.max(
    RIVALRY_INTENSITY_MIN,
    Math.min(RIVALRY_INTENSITY_MAX, Math.round(value)),
  );
}

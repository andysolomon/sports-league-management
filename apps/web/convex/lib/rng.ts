/*
 * Shared deterministic RNG for every seeded system in the app (Dynasty Mode F1).
 *
 * Moved here from `src/lib/rng.ts` in B3, unchanged. The Convex bundler can only
 * reach files under `convex/`, while `src/` can reach both, so anything BOTH
 * runtimes need has to live on this side — the same arrangement as
 * `convex/lib/dynastyConfig.ts` and `convex/lib/offseasonPhases.ts`.
 * `src/lib/rng.ts` re-exports this module, so no import site changed and the
 * generated streams are byte-identical to before the move.
 *
 * Scouting is what forced it: `applyScoutingNoise` has to produce the SAME band
 * whether it runs in the mutation that persists a scout or in the component that
 * renders one, and two copies of a PRNG is exactly the drift this file exists to
 * prevent.
 *
 * ## Why this matters
 *
 * "Same league, same actions => same dynasty" is only true if every seeded
 * system derives its seed the same way and never collides with another system.
 * Two subsystems that hash the same entity id produce the SAME stream — e.g.
 * seeding both a player's progression and his scouting noise from a bare
 * `playerId` would correlate them, so a player who develops well would always
 * also scout well. The namespace convention below prevents that.
 *
 * ## Seed namespace convention
 *
 * Build every seed with `seedFor(domain, ...parts)`:
 *
 *   seedFor("pbp", fixtureId)                    // play-by-play engine
 *   seedFor("progression", playerId, seasonId)   // offseason development
 *   seedFor("scouting", prospectId, String(lvl)) // recruit scouting noise
 *   seedFor("transfer", playerId, seasonId)      // transfer likelihood
 *   seedFor("weather", seasonId, String(week))   // game conditions
 *
 * Rules:
 * - The domain is always first and unique per subsystem.
 * - Include every id the result should vary by, and nothing else. Adding a part
 *   changes the stream, so adding one to an existing domain reshuffles history.
 * - Never seed from wall-clock time or `Math.random()` — that breaks replay,
 *   golden-log parity tests, and re-simulation.
 */

/** Domains registered with the seed-namespace convention. */
export type SeedDomain =
  | "pbp"
  | "progression"
  | "scouting"
  | "prospects"
  | "transfer"
  | "training"
  | "weather"
  | "injury"
  | "penalty"
  | "goals"
  | "roster";

/**
 * FNV-1a over the string, returned as an unsigned 32-bit int. Stable across
 * runs and platforms — the same string always yields the same seed.
 */
export function seedFromString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Namespaced seed. Prefer this over calling `seedFromString` directly so two
 * subsystems keyed on the same entity never share a stream.
 */
export function seedFor(domain: SeedDomain, ...parts: string[]): number {
  return seedFromString([domain, ...parts].join(":"));
}

/**
 * mulberry32 — small, fast, deterministic PRNG. Returns a generator producing
 * numbers in [0, 1). Identical seed => identical sequence.
 */
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

/** Convenience: a generator seeded straight from a namespaced key. */
export function rngFor(domain: SeedDomain, ...parts: string[]): () => number {
  return mulberry32(seedFor(domain, ...parts));
}

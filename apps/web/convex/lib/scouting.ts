/*
 * Recruit scouting (Dynasty Mode B3) — pure, Convex-free.
 *
 * A prospect has a true rating nobody can see. Scouting buys PRECISION, not
 * truth: every level narrows the range you are shown, and level 3 still leaves
 * a six-point window. Recruiting is a judgment call or it is a spreadsheet.
 *
 * ## The two things that could go wrong, and how the construction prevents them
 *
 * 1. **A band that lies.** If the range could exclude the true overall, a coach
 *    who scouted to level 3 and signed the top-ranked kid could get someone
 *    strictly worse than every number he was shown, and there would be no way to
 *    tell an unlucky read from a bug. So the band ALWAYS contains the truth. The
 *    uncertainty is in the width, never in the placement.
 *
 *    Bust risk lives somewhere honest instead: `potentialTier` is hidden at every
 *    scout level and is what decides who a prospect BECOMES. You can know almost
 *    exactly what a player is today and still be wrong about him.
 *
 * 2. **Bands that do not nest.** The obvious implementation draws an independent
 *    range per level, and then level 3 can sit outside level 2 — so spending a
 *    point can move the range AWAY from where it was, which reads as the game
 *    lying to you. This builds the TIGHTEST band first and widens outward for
 *    each lower level, so containment is structural rather than asserted:
 *    band(3) ⊆ band(2) ⊆ band(1) ⊆ band(0) holds for every prospect by
 *    construction, and the tests only have to confirm it survived clamping.
 *
 * Deterministic per `(prospectId, scoutLevel)` — see the seed convention in
 * `convex/lib/rng.ts`. Re-reading a prospect never reshuffles his range.
 */
import { rngFor } from "./rng";

/** Ratings live on the same 40–99 scale as `generateSyntheticAttributes`. */
export const OVERALL_MIN = 40;
export const OVERALL_MAX = 99;

export const MIN_SCOUT_LEVEL = 0;
export const MAX_SCOUT_LEVEL = 3;

/**
 * Width of the projected-overall band at each scout level.
 *
 * Strictly decreasing, and never zero: a fully scouted prospect is a six-point
 * question, not an answer. 36 points at level 0 is deliberately close to
 * useless — an unscouted board should feel like noise, because that is what
 * makes spending the budget a decision.
 */
export const SCOUT_BAND_WIDTH: readonly number[] = [36, 24, 14, 6];

/**
 * Cost to move from level `i - 1` to level `i`. Index 0 is unused (everyone
 * starts at level 0 for free).
 *
 * Rising costs mean a fixed budget buys either a broad look at the whole class
 * or certainty about a few names, and never both.
 */
export const SCOUT_LEVEL_COST: readonly number[] = [0, 5, 10, 20];

/**
 * Prospects generated per team, and the most any one team may sign.
 *
 * One number for both on purpose. It makes the class exactly big enough for
 * every program to fill its board and not one name bigger, so recruiting is a
 * contest over WHICH six rather than a queue where the last team still gets its
 * pick. A larger class would make the board a formality; a per-team cap above
 * the class share would let one program take everything.
 */
export const RECRUITING_CLASS_PER_TEAM = 6;

/** Hidden development ceiling. Drives who a prospect BECOMES, not who he is. */
export type PotentialTier = "bust" | "steady" | "riser" | "star";

export const POTENTIAL_TIERS: readonly PotentialTier[] = [
  "bust",
  "steady",
  "riser",
  "star",
];

export function isPotentialTier(value: string): value is PotentialTier {
  return (POTENTIAL_TIERS as readonly string[]).includes(value);
}

/** Cost of the next scout, or `null` when the prospect is fully scouted. */
export function nextScoutCost(scoutLevel: number): number | null {
  const next = scoutLevel + 1;
  if (next > MAX_SCOUT_LEVEL) return null;
  return SCOUT_LEVEL_COST[next] ?? null;
}

export function clampScoutLevel(level: number): number {
  if (!Number.isFinite(level)) return MIN_SCOUT_LEVEL;
  return Math.max(MIN_SCOUT_LEVEL, Math.min(MAX_SCOUT_LEVEL, Math.round(level)));
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export interface ScoutingBand {
  /** Lowest overall the prospect could be, as shown to the coach. */
  projectedLow: number;
  /** Highest overall the prospect could be, as shown to the coach. */
  projectedHigh: number;
}

/**
 * Every level's band for one prospect, index 0..3.
 *
 * Computed together in a single RNG stream on purpose. Deriving level `n` from
 * its own independent stream is what breaks nesting; deriving all four from one
 * pass, tightest first, is what makes nesting free.
 */
export function scoutingBands(
  prospectId: string,
  trueOverall: number,
): ScoutingBand[] {
  const rand = rngFor("scouting", prospectId);
  const truth = clamp(trueOverall, OVERALL_MIN, OVERALL_MAX);

  /*
   * Where truth sits inside the tightest band. Drawn once, so a prospect whose
   * true rating sits at the top of his level-3 window keeps sitting there as
   * the window widens — the band grows around a fixed point rather than
   * jumping.
   */
  const tightest = SCOUT_BAND_WIDTH[MAX_SCOUT_LEVEL] ?? 6;
  let low = truth - rand() * tightest;
  let high = low + tightest;

  const raw = SCOUT_BAND_WIDTH.map(() => ({ low, high }));
  for (let level = MAX_SCOUT_LEVEL - 1; level >= MIN_SCOUT_LEVEL; level--) {
    const width = SCOUT_BAND_WIDTH[level] ?? tightest;
    const extra = Math.max(0, width - (high - low));
    // Split the extra width between the two ends. Never symmetric, so a wider
    // band is not a tell that the midpoint is the answer.
    const below = extra * rand();
    low -= below;
    high += extra - below;
    raw[level] = { low, high };
  }

  /*
   * Clamp onto the ratings scale by sliding the window, not by squashing it.
   * Squashing would let a prospect at 99 end up with a zero-width band at
   * level 3 — an exact answer, handed out by an edge case. Sliding preserves
   * both the width and the nesting (`min` and `max` are monotone, and the
   * per-level cap `OVERALL_MAX - width` is larger for tighter bands).
   */
  return raw.map((band, level) => {
    const width = SCOUT_BAND_WIDTH[level] ?? tightest;
    const slid = clamp(band.low, OVERALL_MIN, OVERALL_MAX - width);
    return {
      projectedLow: Math.round(slid),
      projectedHigh: Math.round(slid) + width,
    };
  });
}

/** The band shown at one scout level. */
export function scoutingBand(
  prospectId: string,
  trueOverall: number,
  scoutLevel: number,
): ScoutingBand {
  const level = clampScoutLevel(scoutLevel);
  const bands = scoutingBands(prospectId, trueOverall);
  return bands[level] ?? bands[MIN_SCOUT_LEVEL];
}

export interface ScoutingReport {
  scoutLevel: number;
  projectedLow: number;
  projectedHigh: number;
  /** Per-attribute reads, blurred by the same amount as the band. */
  scoutedAttributes: Record<string, number>;
}

export interface ApplyScoutingNoiseInput {
  prospectId: string;
  scoutLevel: number;
  trueOverall: number;
  trueAttributes: Record<string, number>;
}

/**
 * What a coach at `scoutLevel` is allowed to see.
 *
 * The ONLY function that turns hidden truth into shown numbers. Keeping it
 * single means the rule "you never see the exact rating" is enforced in one
 * place rather than re-derived at each call site — and it is why nothing but
 * this file needs to touch `trueAttributesJson`.
 *
 * Per-attribute reads use a level-specific stream, so a prospect's blurred
 * ratings genuinely change as he is scouted rather than converging along a
 * path the previous read already revealed.
 */
export function applyScoutingNoise(
  input: ApplyScoutingNoiseInput,
): ScoutingReport {
  const scoutLevel = clampScoutLevel(input.scoutLevel);
  const band = scoutingBand(input.prospectId, input.trueOverall, scoutLevel);

  /*
   * Attribute blur is half the band's width. At level 3 that is ±3 — enough
   * that a coach still cannot rank two similar prospects on a single attribute,
   * which is the point of a scale that stops short of certainty.
   */
  const spread = (SCOUT_BAND_WIDTH[scoutLevel] ?? 36) / 2;
  const rand = rngFor("scouting", input.prospectId, String(scoutLevel));
  const scoutedAttributes: Record<string, number> = {};
  for (const key of Object.keys(input.trueAttributes).sort()) {
    const truth = input.trueAttributes[key] ?? OVERALL_MIN;
    const offset = (rand() * 2 - 1) * spread;
    scoutedAttributes[key] = Math.round(
      clamp(truth + offset, OVERALL_MIN, OVERALL_MAX),
    );
  }

  return {
    scoutLevel,
    projectedLow: band.projectedLow,
    projectedHigh: band.projectedHigh,
    scoutedAttributes,
  };
}

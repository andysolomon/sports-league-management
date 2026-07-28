/*
 * Incoming freshman class generation (Dynasty Mode B3).
 *
 * Builds the pool of prospects a league recruits from. Runs in the Next layer
 * rather than inside Convex — same division of labour as the freshmen rollover
 * stage, which generates in the action and persists through a mutation — because
 * the name, jersey and attribute generators it reuses live under `src/`.
 * Duplicating them into `convex/` to move 40 lines of generation across the
 * boundary would be a worse trade than passing rows.
 *
 * ## What a prospect is, and what it is not
 *
 * A prospect is NOT a replacement for the rollover's roster backfill. That
 * backfill still tops every team up to `targetRosterSize`, so a league that
 * ignores recruiting entirely keeps playable rosters — a phase nobody enters
 * must not be able to produce a broken season. Prospects are the talent ON TOP
 * of that: a shared, contested pool where the backfill is walk-ons.
 *
 * ## Two independent rolls
 *
 * `trueOverall` is who a prospect is now. `potentialTier` is who he becomes, and
 * it is drawn from a SEPARATE stream so it does not correlate with current
 * rating. That independence is the whole risk model: the best player on the
 * board can be a bust and the last name on it can be a star, so scouting buys
 * precision about the present and never certainty about the future.
 */
import {
  generateSyntheticAttributes,
  type SyntheticAttributes,
} from "@/lib/synthetic-attributes";
import { generateSyntheticRoster } from "@/lib/synthetic-roster";
import { rngFor, seedFor } from "@/lib/rng";
import {
  OVERALL_MAX,
  OVERALL_MIN,
  type PotentialTier,
} from "@/lib/dynasty/scouting";

/**
 * Scouting-visible flavour text. Deliberately NOT hidden: an archetype is the
 * kind of player a coach can see at a glance from film, and hiding it would
 * make an unscouted board a wall of identical rows.
 */
const ARCHETYPES: Readonly<Record<string, readonly string[]>> = {
  QB: ["Pocket Passer", "Dual Threat", "Field General"],
  RB: ["Power Back", "Elusive Back", "Receiving Back"],
  WR: ["Deep Threat", "Possession", "Slot Technician"],
  TE: ["Blocking Y", "Vertical Seam", "Move Tight End"],
  OL: ["Road Grader", "Pass Protector", "Athletic Zone"],
  DL: ["Edge Rusher", "Run Stuffer", "Interior Penetrator"],
  LB: ["Thumper", "Coverage Backer", "Blitzer"],
  DB: ["Man Corner", "Zone Corner", "Ballhawk Safety"],
  K: ["Big Leg", "Accurate"],
  P: ["Big Leg", "Directional"],
};

const DEFAULT_ARCHETYPES: readonly string[] = ["Athlete"];

/**
 * Tier weights. Most of a class is what it looks like; the tails are why you
 * care. A quarter bust and a tenth star is enough spread that a good class and
 * a bad one are distinguishable four years later without making every signing
 * a coin flip.
 */
const TIER_WEIGHTS: ReadonlyArray<{ tier: PotentialTier; weight: number }> = [
  { tier: "bust", weight: 25 },
  { tier: "steady", weight: 40 },
  { tier: "riser", weight: 25 },
  { tier: "star", weight: 10 },
];

function pickTier(roll: number): PotentialTier {
  const total = TIER_WEIGHTS.reduce((sum, t) => sum + t.weight, 0);
  let cursor = roll * total;
  for (const entry of TIER_WEIGHTS) {
    cursor -= entry.weight;
    if (cursor < 0) return entry.tier;
  }
  return "steady";
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export interface GeneratedProspect {
  name: string;
  position: string;
  positionGroup: string;
  archetype: string;
  hometown: string | null;
  /** Hidden. Never leaves the server unblurred — see `applyScoutingNoise`. */
  trueAttributes: Record<string, number>;
  /** Hidden. The number the projected band is built around. */
  trueOverall: number;
  /** Hidden at every scout level, including 3. */
  potentialTier: PotentialTier;
}

export interface GenerateProspectClassInput {
  /** Stable key for the class — the target season the prospects sign into. */
  seasonId: string;
  count: number;
  /** Names already in the league, so a prospect never shares one. */
  excludeNames?: string[];
}

/**
 * A deterministic recruiting class for one season.
 *
 * Seeded from the season alone, so re-running a rollover that lost its response
 * produces the SAME class rather than a second one — the persistence layer's
 * idempotence guard and this seed have to agree or a retry doubles the board.
 */
export function generateProspectClass(
  input: GenerateProspectClassInput,
): GeneratedProspect[] {
  const count = Math.max(0, Math.floor(input.count));
  if (count === 0) return [];

  /*
   * Reused for names, positions and hometowns only. The roster generator caps
   * at 99 per call because it also hands out unique jerseys; prospects have no
   * jersey until they sign, so a class larger than that is generated in chunks
   * with a per-chunk seed.
   */
  const CHUNK = 90;
  const base: Array<{
    name: string;
    position: string;
    hometown: string | null;
  }> = [];
  const used = new Set<string>(input.excludeNames ?? []);
  for (let offset = 0; offset < count; offset += CHUNK) {
    const chunk = generateSyntheticRoster({
      count: Math.min(CHUNK, count - offset),
      grade: 9,
      excludeNames: Array.from(used),
      seed: seedFor("prospects", input.seasonId, String(offset)),
    });
    for (const row of chunk) {
      used.add(row.name);
      base.push({
        name: row.name,
        position: row.position,
        hometown: row.hometown ?? null,
      });
    }
  }

  return base.map((row, index) => {
    const prospectKey = `${input.seasonId}:${index}`;
    const attributes: SyntheticAttributes = generateSyntheticAttributes({
      position: row.position,
      seed: seedFor("prospects", prospectKey, "attributes"),
    });

    /*
     * Widen the class past what the roster generator produces on its own
     * (a 58–90 base). A recruiting board where every name lands mid-pack gives
     * scouting nothing to find; the tilt pushes the tails out to roughly
     * 45–95 so the top of the board is genuinely worth the points.
     */
    const shape = rngFor("prospects", prospectKey, "shape");
    const tilt = Math.round((shape() - 0.55) * 18);
    const trueAttributes: Record<string, number> = {};
    for (const [key, value] of Object.entries(attributes.attributes)) {
      trueAttributes[key] = Math.round(
        clamp(value + tilt, OVERALL_MIN, OVERALL_MAX),
      );
    }
    const values = Object.values(trueAttributes);
    const trueOverall = values.length
      ? Math.round(
          clamp(
            values.reduce((sum, n) => sum + n, 0) / values.length,
            OVERALL_MIN,
            OVERALL_MAX,
          ),
        )
      : OVERALL_MIN;

    // Separate stream from `shape` — see the two-independent-rolls note above.
    const potentialTier = pickTier(rngFor("prospects", prospectKey, "tier")());

    const pool = ARCHETYPES[attributes.positionGroup] ?? DEFAULT_ARCHETYPES;
    const archetype =
      pool[Math.floor(shape() * pool.length)] ?? pool[0] ?? "Athlete";

    return {
      name: row.name,
      position: row.position,
      positionGroup: attributes.positionGroup,
      archetype,
      hometown: row.hometown,
      trueAttributes,
      trueOverall,
      potentialTier,
    };
  });
}

/**
 * How many prospects a league's class holds.
 *
 * Scaled by team count so recruiting is contested at any league size: more
 * names than any one program can sign, fewer than every program signing its
 * fill. `perTeam` above the per-team cap would make the board a formality.
 */
export function prospectClassSize(teamCount: number, perTeam = 6): number {
  return Math.max(0, Math.floor(teamCount) * Math.max(0, Math.floor(perTeam)));
}

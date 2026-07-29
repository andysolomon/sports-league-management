/*
 * Offseason training (Dynasty Mode B6) — pure, Convex-free.
 *
 * Development is entirely automatic today: `computeProgressedAttributes` moves
 * every player by a seeded amount and a coach watches. This is the half that
 * makes it a decision — a finite budget, spent on named players in a named
 * direction.
 *
 * ## The three properties the whole slice rests on
 *
 * 1. **Spreading beats dumping.** The yield is `sqrt(points)`, so ten points on
 *    one player earn far less than one point on ten. A linear yield would make
 *    the budget a single choice ("who is the best player?") rather than a
 *    portfolio; a hard cap would do the same thing with a cliff, and would stop
 *    being monotonic exactly where a coach is deciding.
 *
 * 2. **Focus changes SHAPE, never total.** Every focus turns the same points
 *    into the same number of attribute points; they land on different
 *    attributes. So a coach picking a focus is choosing what kind of player he
 *    wants, not trying to guess which focus is secretly worth more. Overall is
 *    the mean of the map, so the overall gain is identical either way and the
 *    difference is entirely legible in the ratings that moved.
 *
 * 3. **Points are never silently wasted.** Attributes cap at 99, so a naive
 *    "add n to each key" would quietly discard the training of a player already
 *    at the ceiling. Distribution walks the keys with headroom, lowest first —
 *    coaching lifts the floor within a focus before it sharpens the peak.
 *
 * Deliberately NOT seeded. Every other dynasty mechanic is random and
 * reproducible; training is the one a coach paid for, and a spent point that
 * rolled badly would be indistinguishable from a bug.
 */
import { GROUP_KEYS, type AttributeGroup } from "./positions";

/** Ratings live on the same 40–99 scale as `generateSyntheticAttributes`. */
export const ATTRIBUTE_MIN = 40;
export const ATTRIBUTE_MAX = 99;

export type TrainingFocus =
  | "athleticism"
  | "strength"
  | "technique"
  | "football_iq";

export interface TrainingFocusMeta {
  id: TrainingFocus;
  label: string;
  /** What a coach is buying, in one line, for the panel. */
  blurb: string;
}

/**
 * The four directions a program can develop a player.
 *
 * Four rather than one-per-attribute because a focus has to be a coaching
 * decision a person can hold in their head. "Work on his release" is a drill;
 * "he is our technique project this spring" is a plan.
 */
export const TRAINING_FOCUSES: readonly TrainingFocusMeta[] = [
  {
    id: "athleticism",
    label: "Athleticism",
    blurb: "Speed, acceleration and agility.",
  },
  { id: "strength", label: "Strength", blurb: "Raw power and stamina." },
  {
    id: "technique",
    label: "Technique",
    blurb: "The skills specific to his position.",
  },
  {
    id: "football_iq",
    label: "Football IQ",
    blurb: "Awareness and reading the game.",
  },
];

export function isTrainingFocus(value: string): value is TrainingFocus {
  return TRAINING_FOCUSES.some((focus) => focus.id === value);
}

/**
 * Attribute keys each focus develops, for the athletic attributes every player
 * carries. `technique` is absent because it resolves through the player's
 * position group instead — see `focusAttributeKeys`.
 */
const COMMON_FOCUS_KEYS: Readonly<
  Partial<Record<TrainingFocus, readonly string[]>>
> = {
  athleticism: ["SPD", "ACC", "AGI"],
  strength: ["STR", "STA"],
  football_iq: ["AWR"],
};

/**
 * Which attributes a focus develops for a player in `positionGroup`.
 *
 * `technique` is the only focus whose keys depend on position, and that is the
 * point of it: a quarterback's technique is throw power and accuracy, a
 * lineman's is run and pass blocking. Routing it through the same `GROUP_KEYS`
 * the attribute generator uses means a group can never gain a technique
 * attribute that training cannot reach.
 */
export function focusAttributeKeys(
  focus: TrainingFocus,
  positionGroup: string,
): readonly string[] {
  if (focus !== "technique") return COMMON_FOCUS_KEYS[focus] ?? [];
  const keys = GROUP_KEYS[positionGroup as AttributeGroup];
  return keys ?? [];
}

/** Points a coach may commit to one player at once. */
export const TRAINING_POINT_OPTIONS: readonly number[] = [2, 5, 10];

/**
 * Attribute points earned per `sqrt(point)`.
 *
 * Two is calibrated against the seeded base progression, which moves a player
 * by an overall-equivalent 2–5 a year. Five training points earn ~4.5 attribute
 * points, so a well-spent offseason is worth roughly one extra year of natural
 * growth for the handful of players it is spent on — noticeable, and nowhere
 * near enough to make development a solved problem.
 */
export const TRAINING_YIELD = 2;

/**
 * Coach development rating and facilities are 0–100 with 50 neutral.
 *
 * Absent means neutral, not zero. C1 and C2 have not shipped, so no league has
 * a coach rating or a facilities score yet; treating that absence as a bad
 * coach would make every league's training worse than it will be next month for
 * no reason a player could see. This is a multiplier on an effect, not an
 * invented fact about anyone.
 */
export const NEUTRAL_RATING = 50;
const DEVELOPMENT_SWING = 0.5;
const FACILITIES_SWING = 0.3;

function ratingMultiplier(rating: number | null | undefined, swing: number): number {
  if (rating === null || rating === undefined || !Number.isFinite(rating)) {
    return 1;
  }
  const clamped = Math.max(0, Math.min(100, rating));
  return 1 - swing / 2 + (clamped / 100) * swing;
}

export interface TrainingBonusInput {
  focus: string;
  points: number;
  positionGroup: string;
  /** Coach development rating, 0–100. Null until C1 ships one. */
  developmentRating?: number | null;
  /** Program facilities, 0–100. Null until C2 ships them. */
  facilities?: number | null;
}

/**
 * Attribute points a training allocation earns, before they are placed.
 *
 * Strictly increasing in `points`, `developmentRating` and `facilities`, and
 * independent of `focus` — see property 2 in the header. Returns a real number;
 * rounding happens once, at distribution, so a coach who splits a budget across
 * two allocations is not taxed twice by the same rounding.
 */
export function trainingBonus(input: TrainingBonusInput): number {
  if (!isTrainingFocus(input.focus)) return 0;
  if (!Number.isFinite(input.points) || input.points <= 0) return 0;
  if (focusAttributeKeys(input.focus, input.positionGroup).length === 0) {
    return 0;
  }
  return (
    TRAINING_YIELD *
    Math.sqrt(input.points) *
    ratingMultiplier(input.developmentRating, DEVELOPMENT_SWING) *
    ratingMultiplier(input.facilities, FACILITIES_SWING)
  );
}

export interface TrainingAllocation {
  focus: string;
  points: number;
}

export interface ApplyTrainingInput {
  attributes: Readonly<Record<string, number>>;
  positionGroup: string;
  allocations: readonly TrainingAllocation[];
  developmentRating?: number | null;
  facilities?: number | null;
  /**
   * A direct multiplier on the earned points, for callers that hold a
   * multiplier rather than the 0–100 ratings behind one — `ProgressionInput`'s
   * `developmentMultiplier` is the only one today. Absent is 1, so it never
   * changes a result by being omitted.
   */
  multiplier?: number | null;
}

export interface AppliedTraining {
  /** The full map after training — unchanged keys included. */
  attributes: Record<string, number>;
  /** Per-key gain, for "what did my points buy". Only non-zero keys. */
  gains: Record<string, number>;
  /** Attribute points actually placed. Below the earned total at the ceiling. */
  pointsPlaced: number;
}

/**
 * Place earned attribute points on a player's ratings.
 *
 * One point at a time onto the lowest-rated key in the focus that still has
 * headroom. That ordering is the coaching model: a spring spent on athleticism
 * closes the gap between a player's speed and his agility before it makes his
 * best trait better. It also makes the placement total-preserving, which a
 * flat "share it out and round" is not — rounding down four ways is how a
 * coach loses a point they paid for.
 */
export function applyTraining(input: ApplyTrainingInput): AppliedTraining {
  const attributes: Record<string, number> = { ...input.attributes };
  const gains: Record<string, number> = {};
  let pointsPlaced = 0;

  const multiplier =
    input.multiplier === null ||
    input.multiplier === undefined ||
    !Number.isFinite(input.multiplier)
      ? 1
      : Math.max(0, input.multiplier);

  for (const allocation of input.allocations) {
    if (!isTrainingFocus(allocation.focus)) continue;
    const earned = Math.round(
      trainingBonus({
        focus: allocation.focus,
        points: allocation.points,
        positionGroup: input.positionGroup,
        developmentRating: input.developmentRating,
        facilities: input.facilities,
      }) * multiplier,
    );
    if (earned <= 0) continue;

    /*
     * Only keys the player actually has. A rating that is not in the map is not
     * a zero he can train up from — it is an attribute this player was never
     * given, and inventing it here would put a coverage rating on a punter.
     */
    const keys = focusAttributeKeys(allocation.focus, input.positionGroup)
      .filter((key) => Object.prototype.hasOwnProperty.call(attributes, key))
      .slice()
      .sort();
    if (keys.length === 0) continue;

    for (let placed = 0; placed < earned; placed++) {
      let target: string | null = null;
      for (const key of keys) {
        if ((attributes[key] ?? 0) >= ATTRIBUTE_MAX) continue;
        if (target === null || (attributes[key] ?? 0) < (attributes[target] ?? 0)) {
          target = key;
        }
      }
      // Every key in the focus is maxed. The rest of this allocation has
      // nowhere to go, and saying so beats pretending it landed.
      if (target === null) break;
      attributes[target] = (attributes[target] ?? 0) + 1;
      gains[target] = (gains[target] ?? 0) + 1;
      pointsPlaced++;
    }
  }

  return { attributes, gains, pointsPlaced };
}

/** Points already committed, for a budget meter or an over-budget check. */
export function totalAllocatedPoints(
  allocations: readonly { points: number }[],
): number {
  return allocations.reduce(
    (sum, row) => sum + (Number.isFinite(row.points) ? row.points : 0),
    0,
  );
}

export type TrainingRejection =
  | "invalid_focus"
  | "invalid_points"
  | "training_budget_exhausted";

export interface TrainingBudgetInput {
  points: number;
  focus: string;
  /** Points this team has already committed for the season. */
  spent: number;
  /** This team's allowance for the season. */
  total: number;
}

export type TrainingDecision =
  | { ok: true }
  | { ok: false; reason: TrainingRejection };

/**
 * Whether an allocation may be recorded.
 *
 * The panel and the mutation both call this, so a control that is offered is a
 * control that works. The budget is checked against the team's own spend, not
 * the league's — see the note on `playerTrainingAllocations` in
 * `convex/tables/offseason.ts` for why training diverges from scouting there.
 */
export function trainingGate(input: TrainingBudgetInput): TrainingDecision {
  if (!isTrainingFocus(input.focus)) {
    return { ok: false, reason: "invalid_focus" };
  }
  if (!Number.isFinite(input.points) || input.points <= 0) {
    return { ok: false, reason: "invalid_points" };
  }
  if (!Number.isInteger(input.points)) {
    return { ok: false, reason: "invalid_points" };
  }
  if (input.spent + input.points > input.total) {
    return { ok: false, reason: "training_budget_exhausted" };
  }
  return { ok: true };
}

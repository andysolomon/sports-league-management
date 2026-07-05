/*
 * Synthetic player-attribute generator (WSM-000175).
 *
 * Companion to `synthetic-roster.ts`: where that fills a roster with fake
 * players, this gives those players believable Madden-style ratings so the
 * SPRT rating / development / ranking surfaces have data to show in demos and
 * tests. Never real player data.
 *
 * Pure + deterministic given a seed (e.g. seedFromString(playerId)), so
 * re-running a team yields stable ratings and the lib is unit-testable. The
 * output shape matches what `ingestPlayerAttributesBatch` expects: a
 * position-group code, a 0–99 attribute map, and a weighted overall.
 */
import { derivePositionGroup } from "@/lib/position-group";
import { seedFromString } from "@/lib/synthetic-roster";

/** Attribute-domain position groups (kicker/punter split, unlike the roster
 *  K/P group). Mirrors `lib/attributes/position-groups.ts`. */
export type AttributeGroup =
  | "QB"
  | "RB"
  | "WR"
  | "TE"
  | "OL"
  | "DL"
  | "LB"
  | "DB"
  | "K"
  | "P";

/** Universal athletic attributes every group carries. */
export const COMMON_KEYS: readonly string[] = ["SPD", "STR", "AGI", "ACC", "AWR", "STA"];

/** Madden-style position-specific attribute codes per group. */
export const GROUP_KEYS: Readonly<Record<AttributeGroup, readonly string[]>> = {
  QB: ["THP", "SAC", "MAC", "DAC", "TUP", "PAC"],
  RB: ["CAR", "BCV", "TRK", "ELU", "JKM", "BTK"],
  WR: ["CTH", "SRR", "MRR", "DRR", "CIT", "RLS"],
  TE: ["CTH", "RBK", "CIT", "SRR", "PBK"],
  OL: ["RBK", "PBK", "RBP", "PBP", "IBL"],
  DL: ["PMV", "FMV", "BSH", "TAK", "PUR"],
  LB: ["TAK", "PUR", "PRC", "ZCV", "MCV", "POW"],
  DB: ["MCV", "ZCV", "PRS", "CTH", "PUR"],
  K: ["KPW", "KAC"],
  P: ["KPW", "KAC"],
};

/**
 * Map a concrete roster position to an attribute-domain group. The roster
 * util collapses kickers + punters into "K/P"; here we split them by the
 * concrete position. Unmappable positions (e.g. "ATH") fall back to "WR" — a
 * generic athletic skill profile — so every synthetic player gets ratings.
 */
export function attributeGroupForPosition(position: string): AttributeGroup {
  const group = derivePositionGroup(position);
  if (group === "K/P") {
    return position.trim().toUpperCase() === "P" ? "P" : "K";
  }
  if (group === null) return "WR";
  return group;
}

/** mulberry32 — tiny deterministic PRNG (same family as synthetic-roster). */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export interface SyntheticAttributes {
  /** Attribute-domain position group (e.g. "QB", "DB"). */
  positionGroup: AttributeGroup;
  /** Madden-style attribute map, integer values 0–99. */
  attributes: Record<string, number>;
  /** Rounded overall (40–99), the mean of the player's attributes. */
  weightedOverall: number;
}

export interface GenerateAttributesOptions {
  position: string;
  /** Seed for deterministic output (e.g. seedFromString(playerId)). */
  seed: number;
}

/**
 * Generate a believable attribute snapshot for one player. Each player gets a
 * base skill level (≈58–90) from the seed, then every attribute jitters around
 * it (±12), clamped to 40–99. The overall is the rounded mean of the map.
 */
export function generateSyntheticAttributes({
  position,
  seed,
}: GenerateAttributesOptions): SyntheticAttributes {
  const positionGroup = attributeGroupForPosition(position);
  const rand = rng(seed);

  // Per-player base skill: most players land mid-pack, a few are studs.
  const base = 58 + Math.floor(rand() * 33); // 58–90

  const keys = [...COMMON_KEYS, ...GROUP_KEYS[positionGroup]];
  const attributes: Record<string, number> = {};
  let sum = 0;
  for (const key of keys) {
    // Skip duplicate keys (a group could repeat a common one) — first wins.
    if (key in attributes) continue;
    const jitter = Math.floor(rand() * 25) - 12; // -12..+12
    const value = clamp(base + jitter, 40, 99);
    attributes[key] = value;
    sum += value;
  }

  const count = Object.keys(attributes).length;
  const weightedOverall = count > 0 ? clamp(Math.round(sum / count), 40, 99) : base;

  return { positionGroup, attributes, weightedOverall };
}

export { seedFromString };

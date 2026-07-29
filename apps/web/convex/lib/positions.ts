/*
 * The position vocabulary, shared by both runtimes (Dynasty Mode B5).
 *
 * Everything here was already in the codebase — the roster-group map lived in
 * `src/lib/position-group.ts`, the attribute-group split in
 * `src/lib/synthetic-attributes.ts`, and the development weights in
 * `src/lib/dynasty-progression.ts`. B5 moved them here and left re-exports
 * behind, for the same reason B3 moved the RNG: a position change is validated
 * in a Convex mutation and previewed in a React panel, and the two must agree
 * about what a position IS. A second copy under `convex/` would be a fork of
 * the app's football vocabulary that nothing would notice had drifted until a
 * coach moved a player to a position one side had never heard of.
 *
 * No Convex imports — this is a pure data module.
 */

/** Roster-facing groups. Kickers and punters share one, as the roster UI shows them. */
export type PositionGroup =
  | "QB"
  | "RB"
  | "WR"
  | "TE"
  | "OL"
  | "DL"
  | "LB"
  | "DB"
  | "K/P";

/**
 * Every position the app recognises.
 *
 * This is the authority for "is that a real position", which is what
 * `changePlayerPosition` validates against. Deliberately the full vocabulary
 * rather than a shorter list built for the dropdown: a position that arrived
 * from an import or a seed is still a position, and rejecting it because it is
 * not offered in a select would be the UI dictating the data model.
 */
export const POSITION_TO_GROUP: Readonly<Record<string, PositionGroup>> = {
  QB: "QB",
  HB: "RB",
  RB: "RB",
  FB: "RB",
  WR: "WR",
  TE: "TE",
  LT: "OL",
  LG: "OL",
  C: "OL",
  RG: "OL",
  RT: "OL",
  G: "OL",
  OG: "OL",
  OT: "OL",
  OL: "OL",
  DE: "DL",
  DT: "DL",
  NT: "DL",
  EDGE: "DL",
  DL: "DL",
  OLB: "LB",
  MLB: "LB",
  ILB: "LB",
  LB: "LB",
  CB: "DB",
  S: "DB",
  FS: "DB",
  SS: "DB",
  NB: "DB",
  DB: "DB",
  K: "K/P",
  PK: "K/P",
  P: "K/P",
  LS: "K/P",
};

/** The roster group for a position, or null when it is not one we know. */
export function derivePositionGroup(position: string): PositionGroup | null {
  const normalized = position.trim().toUpperCase();
  return POSITION_TO_GROUP[normalized] ?? null;
}

/**
 * Attribute-domain groups. Kickers and punters split here, unlike the roster
 * group above, because they are rated on different things.
 */
export const ATTRIBUTE_GROUPS = [
  "QB",
  "RB",
  "WR",
  "TE",
  "OL",
  "DL",
  "LB",
  "DB",
  "K",
  "P",
] as const;

export type AttributeGroup = (typeof ATTRIBUTE_GROUPS)[number];

/**
 * Map a concrete position to its attribute group.
 *
 * Unmappable positions fall back to "WR" — a generic athletic profile — so
 * every player has ratings. That fallback predates B5 and is preserved
 * verbatim; changing it would silently re-rate existing players.
 */
export function attributeGroupForPosition(position: string): AttributeGroup {
  const group = derivePositionGroup(position);
  if (group === "K/P") {
    return position.trim().toUpperCase() === "P" ? "P" : "K";
  }
  if (group === null) return "WR";
  return group;
}

/**
 * Position-tilted attribute weights (higher weight → the position leans on
 * that attribute more).
 *
 * Two mechanics read this and they read it for opposite reasons. Offseason
 * progression uses it to decide where a player's development GOES; B5's
 * position fit uses it to decide whether the athlete he already is SUITS a
 * position. Same emphasis, both directions — which is why they must not be two
 * tables that agree by coincidence.
 */
export const POSITION_ATTR_WEIGHTS: Readonly<
  Record<string, Partial<Record<string, number>>>
> = {
  QB: { THP: 1.4, SAC: 1.2, AWR: 1.3, SPD: 0.8 },
  RB: { SPD: 1.5, AGI: 1.3, ACC: 1.2, CAR: 1.1 },
  WR: { SPD: 1.4, CTH: 1.2, SRR: 1.2, AGI: 1.1 },
  TE: { CTH: 1.3, STR: 1.2, SPD: 1.0 },
  OL: { STR: 1.4, RBK: 1.2, PBK: 1.2 },
  DL: { STR: 1.3, PMV: 1.2, FMV: 1.2, BSH: 1.1 },
  LB: { SPD: 1.2, TAK: 1.3, PRC: 1.2, AWR: 1.1 },
  DB: { SPD: 1.4, AGI: 1.3, MCV: 1.2, ZCV: 1.2 },
  K: { KPW: 1.2, KAC: 1.2 },
  P: { KPW: 1.2, KAC: 1.2 },
};

/** The weight an attribute carries for a group; 1 when the group is indifferent. */
export function attrWeight(positionGroup: string, key: string): number {
  return POSITION_ATTR_WEIGHTS[positionGroup]?.[key] ?? 1;
}

/**
 * The positions the position-change control offers.
 *
 * A curated subset of `POSITION_TO_GROUP` — one representative per role rather
 * than all thirty-four, because a select with every offensive-line variant in
 * it is a worse control, not a more honest one. The mutation validates against
 * the full map, so this list narrows what is SUGGESTED and never what is
 * legal.
 */
export const POSITION_CHANGE_OPTIONS: readonly string[] = [
  "QB",
  "HB",
  "FB",
  "WR",
  "TE",
  "OT",
  "OG",
  "C",
  "DE",
  "DT",
  "OLB",
  "MLB",
  "CB",
  "FS",
  "SS",
  "K",
  "P",
];

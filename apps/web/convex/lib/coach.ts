/*
 * Coach identity helpers (Dynasty Mode C1) — pure, Convex-free.
 *
 * AI head coaches are seeded once per team with deterministic names and ratings
 * so a league backfill is reproducible and idempotent. Re-exported from
 * `src/lib/program/coach.ts` for the Next layer.
 */

import { mulberry32, seedFor } from "./rng";

export const COACH_ROLE_HEAD = "head_coach" as const;
export const COACH_STATUS_AI = "ai" as const;

export const COACH_ARCHETYPES = [
  "program_builder",
  "developer",
  "recruiter",
  "game_manager",
  "disciplinarian",
] as const;

export type CoachArchetype = (typeof COACH_ARCHETYPES)[number];

const FIRST_NAMES = [
  "Marcus",
  "David",
  "James",
  "Robert",
  "Michael",
  "William",
  "Richard",
  "Thomas",
  "Charles",
  "Daniel",
] as const;

const LAST_NAMES = [
  "Hayes",
  "Brooks",
  "Coleman",
  "Foster",
  "Griffin",
  "Harrison",
  "Jenkins",
  "Lawson",
  "Mitchell",
  "Patterson",
] as const;

export interface GeneratedCoachProfile {
  displayName: string;
  archetype: CoachArchetype;
  offensiveSchemePreference: string | null;
  defensiveSchemePreference: string | null;
  aggression: number;
  clockManagement: number;
  developmentRating: number;
  recruitingRating: number;
  gameplanRating: number;
  prestige: number;
}

const SCHEME_PREFS = [
  { off: "spread", def: "four_three" },
  { off: "air_raid", def: "nickel" },
  { off: "pro_style", def: "three_four" },
  { off: "flexbone", def: "four_three" },
  { off: null, def: null },
] as const;

/** Deterministic AI coach profile for a team id. */
export function generateAiHeadCoachProfile(teamId: string): GeneratedCoachProfile {
  const rand = mulberry32(seedFor("coach", teamId, COACH_ROLE_HEAD));
  const first =
    FIRST_NAMES[Math.floor(rand() * FIRST_NAMES.length)] ?? FIRST_NAMES[0];
  const last =
    LAST_NAMES[Math.floor(rand() * LAST_NAMES.length)] ?? LAST_NAMES[0];
  const archetype =
    COACH_ARCHETYPES[Math.floor(rand() * COACH_ARCHETYPES.length)] ??
    COACH_ARCHETYPES[0];
  const schemes =
    SCHEME_PREFS[Math.floor(rand() * SCHEME_PREFS.length)] ?? SCHEME_PREFS[0];
  const rating = (base: number) =>
    Math.max(35, Math.min(85, Math.round(base + (rand() - 0.5) * 24)));

  const prestigeBase = 45 + Math.floor(rand() * 25);

  return {
    displayName: `${first} ${last}`,
    archetype,
    offensiveSchemePreference: schemes.off,
    defensiveSchemePreference: schemes.def,
    aggression: rating(52),
    clockManagement: rating(50),
    developmentRating: rating(55),
    recruitingRating: rating(53),
    gameplanRating: rating(51),
    prestige: prestigeBase,
  };
}

export function formatCoachArchetype(archetype: string): string {
  return archetype
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

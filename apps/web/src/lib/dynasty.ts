/**
 * Dynasty mode helpers — season decided-state, naming, and dedup invariants.
 */
import type { FixtureDto } from "@sports-management/shared-types";
import type { PlayerDto } from "@sports-management/shared-types";
import type { PlayoffBracketDto } from "@/lib/data-api";
import { deriveChampion, regularSeasonProgress } from "@/lib/playoffs";

/** Increment the year embedded in a season name (e.g. "2026" → "2027"). */
export function incrementSeasonName(name: string): string {
  const trailing = name.match(/^(.*?)(\d{4})(\D*)$/);
  if (trailing) {
    const year = Number.parseInt(trailing[2]!, 10);
    return `${trailing[1]}${year + 1}${trailing[3]}`;
  }
  const embedded = name.match(/\d{4}/);
  if (embedded) {
    const year = Number.parseInt(embedded[0], 10);
    return name.replace(embedded[0], String(year + 1));
  }
  return `${name} ${new Date().getFullYear() + 1}`;
}

/** True when a playoff champion exists or is derivable from the bracket. */
export function isChampionDecided(bracket: PlayoffBracketDto | null): boolean {
  if (!bracket || bracket.matchups.length === 0) return false;
  if (bracket.champion) return true;
  return deriveChampion(bracket.matchups, bracket.format ?? "single") !== null;
}

/**
 * A season is decided when a playoff champion exists (bracket present), else
 * when every regular-season fixture is final/cancelled.
 */
export function isSeasonDecided(
  fixtures: FixtureDto[],
  bracket: PlayoffBracketDto | null,
): boolean {
  if (bracket && bracket.matchups.length > 0) {
    return isChampionDecided(bracket);
  }
  return regularSeasonProgress(fixtures).complete;
}

/** Names of non-graduated players — used for freshman dedup (graduated names may recur). */
export function activeNonGraduatedNames(players: PlayerDto[]): string[] {
  return players.filter((p) => p.status !== "graduated").map((p) => p.name);
}

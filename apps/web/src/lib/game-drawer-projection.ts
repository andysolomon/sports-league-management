import type { GameResultDto } from "@sports-management/shared-types";
import type { FixtureDto } from "@sports-management/shared-types";
import type { PlayoffMatchupDto } from "@/lib/data-api";

/** Where the drawer was opened from — affects labels only. */
export type GameDrawerSurface = "schedule" | "playoffs";

export interface GameDrawerTeam {
  id: string | null;
  name: string;
  seed: number | null;
  /** Regular-season W-L(-T), e.g. "3-1". Null when unavailable. */
  record: string | null;
}

/**
 * Serializable, bounded payload for the contextual game drawer (WSM-000240).
 * Built on the server from already-fetched fixture/bracket data — no extra
 * per-matchup queries in the client.
 */
export interface GameDrawerProjection {
  /** Fixture id for schedule rows; playoff matchup id for bracket cards. */
  id: string;
  surface: GameDrawerSurface;
  /** Linked fixture when one exists (playoffs may be null until played). */
  fixtureId: string | null;
  status: "scheduled" | "final" | "cancelled" | null;
  home: GameDrawerTeam;
  away: GameDrawerTeam;
  scheduledAt: string | null;
  venue: string | null;
  homeScore: number | null;
  awayScore: number | null;
  hasPlayLog: boolean;
  /** Playoffs: "Round 1", "Semifinals", etc. */
  roundLabel: string | null;
  isBye: boolean;
}

export function formatTeamRecord(
  wins: number,
  losses: number,
  ties: number,
): string {
  return `${wins}-${losses}${ties ? `-${ties}` : ""}`;
}

export function projectionFromFixture(input: {
  fixture: FixtureDto;
  result: GameResultDto | null;
  hasPlayLog: boolean;
  recordByTeamId?: ReadonlyMap<string, string>;
}): GameDrawerProjection {
  const { fixture, result, hasPlayLog, recordByTeamId } = input;
  const record = (teamId: string) => recordByTeamId?.get(teamId) ?? null;

  return {
    id: fixture.id,
    surface: "schedule",
    fixtureId: fixture.id,
    status: fixture.status,
    home: {
      id: fixture.homeTeamId,
      name: fixture.homeTeamName,
      seed: null,
      record: record(fixture.homeTeamId),
    },
    away: {
      id: fixture.awayTeamId,
      name: fixture.awayTeamName,
      seed: null,
      record: record(fixture.awayTeamId),
    },
    scheduledAt: fixture.scheduledAt,
    venue: fixture.venue,
    homeScore: result?.homeScore ?? null,
    awayScore: result?.awayScore ?? null,
    hasPlayLog,
    roundLabel: null,
    isBye: false,
  };
}

export function projectionFromMatchup(
  matchup: PlayoffMatchupDto,
  roundLabel: string,
): GameDrawerProjection | null {
  if (matchup.isBye) return null;
  if (!matchup.homeTeamId && !matchup.awayTeamId) return null;

  const status =
    matchup.status === "final"
      ? "final"
      : matchup.status === "scheduled"
        ? "scheduled"
        : matchup.status === "cancelled"
          ? "cancelled"
          : matchup.homeScore != null && matchup.awayScore != null
            ? "final"
            : "scheduled";

  return {
    id: matchup.id,
    surface: "playoffs",
    fixtureId: matchup.fixtureId,
    status,
    home: {
      id: matchup.homeTeamId,
      name: matchup.homeTeamName ?? "TBD",
      seed: matchup.homeSeed,
      record: null,
    },
    away: {
      id: matchup.awayTeamId,
      name: matchup.awayTeamName ?? "TBD",
      seed: matchup.awaySeed,
      record: null,
    },
    scheduledAt: null,
    venue: null,
    homeScore: matchup.homeScore,
    awayScore: matchup.awayScore,
    hasPlayLog: matchup.hasPlayLog,
    roundLabel,
    isBye: false,
  };
}

export function gameDrawerMatchupLabel(projection: GameDrawerProjection): string {
  return `${projection.home.name} vs ${projection.away.name}`;
}

export function gameDrawerIsFinal(projection: GameDrawerProjection): boolean {
  return projection.status === "final";
}

export function gameDrawerCanOpenGamecast(
  projection: GameDrawerProjection,
): boolean {
  return (
    gameDrawerIsFinal(projection) &&
    projection.hasPlayLog &&
    projection.fixtureId !== null
  );
}

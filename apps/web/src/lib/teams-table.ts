import type { FixtureDto, PlayerDto, Standing } from "@sports-management/shared-types";
import { formatSeasonRecord } from "@/lib/season-list";

export type FormResult = "W" | "L" | "T";

export interface ResultScores {
  homeScore: number;
  awayScore: number;
}

/** Last five W/L/T chips from final fixtures (prototype formLast5). */
export function formLast5(
  fixtures: ReadonlyArray<
    Pick<FixtureDto, "id" | "status" | "homeTeamId" | "awayTeamId">
  >,
  resultsByFixtureId: ReadonlyMap<string, ResultScores>,
  teamId: string,
): FormResult[] {
  const games = fixtures
    .filter(
      (fixture) =>
        fixture.status === "final" &&
        (fixture.homeTeamId === teamId || fixture.awayTeamId === teamId) &&
        resultsByFixtureId.has(fixture.id),
    )
    .slice(-5);

  return games.map((fixture) => {
    const result = resultsByFixtureId.get(fixture.id)!;
    const us =
      fixture.homeTeamId === teamId ? result.homeScore : result.awayScore;
    const them =
      fixture.homeTeamId === teamId ? result.awayScore : result.homeScore;
    if (us > them) return "W";
    if (us < them) return "L";
    return "T";
  });
}

/** Win percentage for display (prototype: pct * 100, one decimal). */
export function winPercentage(
  wins: number,
  losses: number,
  ties: number,
): string {
  const gamesPlayed = wins + losses + ties;
  if (gamesPlayed === 0) return "—";
  const pct = (wins + ties * 0.5) / gamesPlayed;
  return (pct * 100).toFixed(1);
}

export function standingPointDifferential(row: Standing): number {
  return row.pointsFor - row.pointsAgainst;
}

export function formatStandingRecord(row: Standing): string {
  return formatSeasonRecord(row.wins, row.losses, row.ties);
}

/**
 * Merge standings rows with any league teams missing from standings (0-0 placeholders).
 * Output is sorted by league rank ascending.
 */
export function mergeStandingsWithTeams(
  standings: ReadonlyArray<Standing>,
  teamIds: ReadonlyArray<{ id: string; name: string; divisionId: string }>,
): Standing[] {
  const byTeamId = new Map(standings.map((row) => [row.teamId, row]));
  const merged: Standing[] = [...standings];

  for (const team of teamIds) {
    if (byTeamId.has(team.id)) continue;
    merged.push({
      teamId: team.id,
      teamName: team.name,
      wins: 0,
      losses: 0,
      ties: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      divisionRank: 0,
      leagueRank: merged.length + 1,
    });
  }

  return merged.sort((a, b) => a.leagueRank - b.leagueRank);
}

export interface KeyPlayerRow {
  id: string;
  name: string;
  position: string;
  rating: number | null;
}

/** Top-rated roster players for the detail sheet (prototype starPlayers). */
export function pickKeyPlayers(
  players: ReadonlyArray<Pick<PlayerDto, "id" | "name" | "position">>,
  snapshots: ReadonlyMap<string, { weightedOverall: number | null }>,
  madden: ReadonlyMap<string, number>,
  limit = 4,
): KeyPlayerRow[] {
  return [...players]
    .map((player) => ({
      id: player.id,
      name: player.name,
      position: player.position,
      rating:
        snapshots.get(player.id)?.weightedOverall ??
        madden.get(player.id) ??
        null,
    }))
    .sort((a, b) => {
      if (a.rating != null && b.rating != null) return b.rating - a.rating;
      if (a.rating != null) return -1;
      if (b.rating != null) return 1;
      return a.name.localeCompare(b.name);
    })
    .slice(0, limit);
}

/** Team-level OVR from attribute snapshots (prototype team.ovr). */
export function computeTeamOvr(
  snapshots: ReadonlyMap<string, { weightedOverall: number | null }>,
  madden: ReadonlyMap<string, number>,
): number | null {
  const sprt = [...snapshots.values()]
    .map((snap) => snap.weightedOverall)
    .filter((value): value is number => value != null);
  if (sprt.length > 0) {
    return Math.round(sprt.reduce((sum, value) => sum + value, 0) / sprt.length);
  }
  if (madden.size > 0) {
    const values = [...madden.values()];
    return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
  }
  return null;
}

export function resultsMapFromSeasonLines(
  lines: ReadonlyArray<{ fixtureId: string; homeScore: number; awayScore: number }>,
): Map<string, ResultScores> {
  return new Map(
    lines.map((line) => [
      line.fixtureId,
      { homeScore: line.homeScore, awayScore: line.awayScore },
    ]),
  );
}

export function divisionTeamCount(
  standings: ReadonlyArray<Standing>,
  divisionId: string | null | undefined,
  teams: ReadonlyArray<{ divisionId: string }>,
): number {
  if (!divisionId) return teams.length;
  return teams.filter((team) => team.divisionId === divisionId).length;
}

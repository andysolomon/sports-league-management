/*
 * Phase 3 — Standings computation (Sprint 7 / WSM-000070).
 *
 * Pure function isolated from Convex `db` calls so it can be
 * unit-tested directly. The Convex queries in `sports.ts` hydrate
 * the shapes below + delegate.
 *
 * Tiebreaker chain (per docs/roster-management.md §5.4):
 *   1. wins descending
 *   2. head-to-head record between the two tied teams
 *   3. division win percentage
 *   4. points differential (PF − PA) descending
 *   5. team name ascending (stable final tiebreak)
 */

export interface FixtureLike {
  _id: string;
  seasonId: string;
  homeTeamId: string;
  awayTeamId: string;
  status: string;
}

export interface ResultLike {
  fixtureId: string;
  homeScore: number;
  awayScore: number;
}

export interface TeamLike {
  _id: string;
  name: string;
  divisionId: string | null;
}

export interface ComputeStandingsInput {
  teams: TeamLike[];
  fixtures: FixtureLike[];
  results: ResultLike[];
  /**
   * If set, restrict the output rows to teams in this division.
   * League rank is still computed across ALL teams in the input
   * (so a division-only view still reflects league-wide ordering).
   */
  divisionFilter?: string | null;
}

export interface StandingRow {
  teamId: string;
  teamName: string;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  divisionRank: number;
  leagueRank: number;
}

interface TeamStats {
  teamId: string;
  teamName: string;
  divisionId: string | null;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  divisionWins: number;
  divisionLosses: number;
  divisionTies: number;
  /** Map of opponentTeamId → record vs that opponent. */
  headToHead: Map<string, { w: number; l: number; t: number }>;
}

function bumpH2H(side: TeamStats, oppId: string, kind: "w" | "l" | "t"): void {
  const cur = side.headToHead.get(oppId) ?? { w: 0, l: 0, t: 0 };
  cur[kind] += 1;
  side.headToHead.set(oppId, cur);
}

function divisionWinPct(s: TeamStats): number {
  const games = s.divisionWins + s.divisionLosses + s.divisionTies;
  if (games === 0) return 0;
  return (s.divisionWins + 0.5 * s.divisionTies) / games;
}

function compareStandings(a: TeamStats, b: TeamStats): number {
  if (a.wins !== b.wins) return b.wins - a.wins;

  const aVsB = a.headToHead.get(b.teamId) ?? { w: 0, l: 0, t: 0 };
  if (aVsB.w !== aVsB.l) return aVsB.l - aVsB.w;

  const aDivPct = divisionWinPct(a);
  const bDivPct = divisionWinPct(b);
  if (aDivPct !== bDivPct) return bDivPct - aDivPct;

  const aDiff = a.pointsFor - a.pointsAgainst;
  const bDiff = b.pointsFor - b.pointsAgainst;
  if (aDiff !== bDiff) return bDiff - aDiff;

  return a.teamName.localeCompare(b.teamName);
}

export function computeStandingsPure({
  teams,
  fixtures,
  results,
  divisionFilter,
}: ComputeStandingsInput): StandingRow[] {
  const fixtureById = new Map<string, FixtureLike>(
    fixtures.map((f) => [f._id, f]),
  );

  const stats = new Map<string, TeamStats>();
  for (const t of teams) {
    stats.set(t._id, {
      teamId: t._id,
      teamName: t.name,
      divisionId: t.divisionId ?? null,
      wins: 0,
      losses: 0,
      ties: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      divisionWins: 0,
      divisionLosses: 0,
      divisionTies: 0,
      headToHead: new Map(),
    });
  }

  for (const r of results) {
    const f = fixtureById.get(r.fixtureId);
    if (!f || f.status !== "final") continue;

    const home = stats.get(f.homeTeamId);
    const away = stats.get(f.awayTeamId);
    if (!home || !away) continue;

    home.pointsFor += r.homeScore;
    home.pointsAgainst += r.awayScore;
    away.pointsFor += r.awayScore;
    away.pointsAgainst += r.homeScore;

    const sameDivision =
      home.divisionId !== null && home.divisionId === away.divisionId;

    if (r.homeScore > r.awayScore) {
      home.wins += 1;
      away.losses += 1;
      if (sameDivision) {
        home.divisionWins += 1;
        away.divisionLosses += 1;
      }
      bumpH2H(home, f.awayTeamId, "w");
      bumpH2H(away, f.homeTeamId, "l");
    } else if (r.homeScore < r.awayScore) {
      away.wins += 1;
      home.losses += 1;
      if (sameDivision) {
        away.divisionWins += 1;
        home.divisionLosses += 1;
      }
      bumpH2H(away, f.homeTeamId, "w");
      bumpH2H(home, f.awayTeamId, "l");
    } else {
      home.ties += 1;
      away.ties += 1;
      if (sameDivision) {
        home.divisionTies += 1;
        away.divisionTies += 1;
      }
      bumpH2H(home, f.awayTeamId, "t");
      bumpH2H(away, f.homeTeamId, "t");
    }
  }

  // League-wide sort first; this drives leagueRank.
  const allSorted = Array.from(stats.values()).sort(compareStandings);
  const leagueRankByTeam = new Map<string, number>();
  allSorted.forEach((s, i) => leagueRankByTeam.set(s.teamId, i + 1));

  // Per-division ordering uses the same comparator.
  const divisionGroups = new Map<string | null, TeamStats[]>();
  for (const s of allSorted) {
    const key = s.divisionId;
    const group = divisionGroups.get(key) ?? [];
    group.push(s);
    divisionGroups.set(key, group);
  }
  const divisionRankByTeam = new Map<string, number>();
  for (const group of divisionGroups.values()) {
    group.forEach((s, i) => divisionRankByTeam.set(s.teamId, i + 1));
  }

  const filtered =
    divisionFilter === undefined
      ? allSorted
      : allSorted.filter((s) => s.divisionId === divisionFilter);

  return filtered.map((s) => ({
    teamId: s.teamId,
    teamName: s.teamName,
    wins: s.wins,
    losses: s.losses,
    ties: s.ties,
    pointsFor: s.pointsFor,
    pointsAgainst: s.pointsAgainst,
    leagueRank: leagueRankByTeam.get(s.teamId) ?? 0,
    divisionRank: divisionRankByTeam.get(s.teamId) ?? 0,
  }));
}

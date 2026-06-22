/*
 * WSM-000153 — Single round-robin schedule generation.
 *
 * Pure function isolated from Convex `db` calls so it can be unit-tested
 * directly. `generateSeasonSchedule` in `sports.ts` loads the league's teams
 * and delegates the pairing math here, then inserts the resulting fixtures.
 *
 * Algorithm: the "circle" (polygon) method. Fix the first team and rotate the
 * rest around it; each rotation is one week and yields N/2 pairings. For an
 * odd team count we add a sentinel BYE — whichever team is paired with it
 * simply has no fixture that week (no bye row is stored). Home/away alternates
 * by round so the home-game load stays balanced.
 */

/** A single generated pairing. `week` is 1-based. */
export interface RoundRobinPairing {
  week: number;
  homeTeamId: string;
  awayTeamId: string;
}

const BYE = "__BYE__";

/**
 * Build a single round-robin: every team plays every other team exactly once.
 *
 * @param teamIds distinct team ids (order is preserved as seeded)
 * @returns pairings across weeks 1..(N-1 for even N, N for odd N)
 * @throws if fewer than two teams, or ids are not distinct
 */
export function roundRobinSchedule(teamIds: string[]): RoundRobinPairing[] {
  if (teamIds.length < 2) {
    throw new Error("need_at_least_two_teams");
  }
  if (new Set(teamIds).size !== teamIds.length) {
    throw new Error("duplicate_team_ids");
  }

  // Pad to an even count with a single BYE sentinel for odd team counts.
  const teams = [...teamIds];
  if (teams.length % 2 !== 0) {
    teams.push(BYE);
  }

  const n = teams.length;
  const rounds = n - 1; // weeks needed
  const half = n / 2;

  // `rotating` holds every team except the fixed pivot (teams[0]).
  const pivot = teams[0];
  let rotating = teams.slice(1);

  const pairings: RoundRobinPairing[] = [];

  for (let round = 0; round < rounds; round++) {
    const week = round + 1;
    const column = [pivot, ...rotating];

    for (let i = 0; i < half; i++) {
      const a = column[i];
      const b = column[n - 1 - i];
      if (a === BYE || b === BYE) continue; // resting team — no fixture

      // Balance home/away. The pivot sits in slot 0 every round, so its side
      // must alternate by round to stay even. Every other team rotates through
      // the remaining slots, so fixing their home side by slot-index parity
      // spreads home games evenly: each team ends within one home game of n/2
      // (within two for odd counts, where the bye unavoidably breaks the
      // alternation).
      const aIsHome = i === 0 ? round % 2 === 0 : i % 2 === 0;
      const [homeTeamId, awayTeamId] = aIsHome ? [a, b] : [b, a];
      pairings.push({ week, homeTeamId, awayTeamId });
    }

    // Rotate clockwise: last element moves to the front of the rotating ring.
    rotating = [rotating[rotating.length - 1], ...rotating.slice(0, -1)];
  }

  return pairings;
}

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

/**
 * Kickoff timestamp for a given week of a generated schedule (WSM-000158).
 *
 * Week 1 sits on the season's start date; each subsequent week is +7 days, so
 * every game in a week shares one date. Returns null when the season has no
 * start date (the generator then leaves `scheduledAt` null — week numbers only).
 *
 * Date math is done in UTC off the parsed start, so adding whole weeks never
 * drifts across DST and the result is deterministic (no `Date.now()`).
 *
 * @param seasonStart the season's startDate (`YYYY-MM-DD` or ISO), or null
 * @param week 1-based week number
 * @returns ISO timestamp string, or null if no start date
 */
export function weekKickoff(
  seasonStart: string | null,
  week: number,
): string | null {
  if (!seasonStart) return null;
  const startMs = Date.parse(seasonStart);
  if (Number.isNaN(startMs)) return null;
  return new Date(startMs + (week - 1) * MS_PER_WEEK).toISOString();
}

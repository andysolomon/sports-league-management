/*
 * WSM-000165 — presentation helpers for the playoff bracket UI.
 *
 * Pure functions (node-testable) split out from the React component so the
 * round-grouping and labelling logic has direct unit coverage; the visual
 * layout itself is verified in the browser.
 */
import type { PlayoffMatchupDto } from "@/lib/data-api";

/**
 * Human label for a round. The last round is the Final; earlier rounds are
 * named by how many teams they contain (2^(R-r+1)): Semifinals (4),
 * Quarterfinals (8), Round of 16 (16); anything earlier falls back to "Round N".
 */
export function roundLabel(round: number, totalRounds: number): string {
  const fromEnd = totalRounds - round; // 0 = final
  if (fromEnd === 0) return "Final";
  if (fromEnd === 1) return "Semifinals";
  if (fromEnd === 2) return "Quarterfinals";
  if (fromEnd === 3) return "Round of 16";
  return `Round ${round}`;
}

export interface BracketRound {
  round: number;
  label: string;
  matchups: PlayoffMatchupDto[];
}

/** Group matchups into ordered rounds (1..totalRounds), each sorted by slot. */
export function groupMatchupsByRound(
  matchups: PlayoffMatchupDto[],
  totalRounds: number,
): BracketRound[] {
  const rounds: BracketRound[] = [];
  for (let round = 1; round <= totalRounds; round++) {
    rounds.push({
      round,
      label: roundLabel(round, totalRounds),
      matchups: matchups
        .filter((m) => m.round === round)
        .sort((a, b) => a.slot - b.slot),
    });
  }
  return rounds;
}

/** Which side won, for highlighting. null until the game is final + decisive. */
export function winnerSide(
  m: PlayoffMatchupDto,
): "home" | "away" | null {
  if (!m.winnerTeamId) return null;
  if (m.winnerTeamId === m.homeTeamId) return "home";
  if (m.winnerTeamId === m.awayTeamId) return "away";
  return null;
}

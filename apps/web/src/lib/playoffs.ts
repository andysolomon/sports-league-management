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

/*
 * Double-elimination presentation helpers (WSM-flex-brackets). A double-elim
 * bracket carries `bracketType` per matchup; the UI renders three regions:
 * the winners bracket (single-elim layout), the losers bracket, and a single
 * grand final.
 */

export interface BracketSection {
  /** "winners" | "losers" | "grandFinal" */
  type: string;
  title: string;
  rounds: BracketRound[];
}

/** Generic round label for the losers bracket (no fixed "Final/Semis" names). */
function loserRoundLabel(round: number, totalRounds: number): string {
  return round === totalRounds ? "Losers Final" : `Losers R${round}`;
}

/**
 * Split a (single- or double-elim) bracket into ordered display sections.
 * Single-elim → one untitled "winners" section using the standard round names.
 * Double-elim → winners bracket, losers bracket, and the grand final.
 */
export function bracketSections(
  matchups: PlayoffMatchupDto[],
  wbRounds: number,
  format: string,
): BracketSection[] {
  if (format !== "double") {
    return [
      {
        type: "winners",
        title: "",
        rounds: groupMatchupsByRound(matchups, wbRounds),
      },
    ];
  }

  const wb = matchups.filter((m) => (m.bracketType ?? "winners") === "winners");
  const lb = matchups.filter((m) => m.bracketType === "losers");
  const gf = matchups.filter((m) => m.bracketType === "grandFinal");

  const sections: BracketSection[] = [
    {
      type: "winners",
      title: "Winners Bracket",
      rounds: groupMatchupsByRound(wb, wbRounds),
    },
  ];

  if (lb.length > 0) {
    const lbRounds = Math.max(...lb.map((m) => m.round));
    const rounds: BracketRound[] = [];
    for (let round = 1; round <= lbRounds; round++) {
      rounds.push({
        round,
        label: loserRoundLabel(round, lbRounds),
        matchups: lb
          .filter((m) => m.round === round)
          .sort((a, b) => a.slot - b.slot),
      });
    }
    sections.push({ type: "losers", title: "Losers Bracket", rounds });
  }

  if (gf.length > 0) {
    sections.push({
      type: "grandFinal",
      title: "Grand Final",
      rounds: [{ round: 1, label: "Grand Final", matchups: gf }],
    });
  }

  return sections;
}

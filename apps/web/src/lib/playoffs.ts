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

export interface ChampionInfo {
  teamId: string;
  teamName: string | null;
}

/** Derive the season champion from bracket matchups (null until the final is decided). */
export function deriveChampion(
  matchups: PlayoffMatchupDto[],
  format: string,
): ChampionInfo | null {
  if (format === "double") {
    const grandFinal = matchups.find((m) => m.bracketType === "grandFinal");
    if (!grandFinal?.winnerTeamId) return null;
    return {
      teamId: grandFinal.winnerTeamId,
      teamName:
        grandFinal.winnerTeamId === grandFinal.homeTeamId
          ? grandFinal.homeTeamName
          : grandFinal.awayTeamName,
    };
  }
  const final = matchups.reduce<PlayoffMatchupDto | null>(
    (best, m) =>
      (m.bracketType ?? "winners") === "winners" && m.round > (best?.round ?? -1)
        ? m
        : best,
    null,
  );
  if (!final?.winnerTeamId) return null;
  return {
    teamId: final.winnerTeamId,
    teamName:
      final.winnerTeamId === final.homeTeamId
        ? final.homeTeamName
        : final.awayTeamName,
  };
}

export interface RegularSeasonProgress {
  total: number;
  final: number;
  complete: boolean;
}

/** Count regular-season fixture completion (playoff games excluded). */
export function regularSeasonProgress(
  fixtures: Array<{ stage: string; status: string }>,
): RegularSeasonProgress {
  const regular = fixtures.filter((f) => f.stage !== "playoff");
  const total = regular.length;
  const finalCount = regular.filter(
    (f) => f.status === "final" || f.status === "cancelled",
  ).length;
  return {
    total,
    final: finalCount,
    complete: total === 0 || finalCount === total,
  };
}

/** Standard playoff field sizes for newly started brackets (WSM-000241). */
export const STANDARD_PLAYOFF_TEAM_COUNTS = [4, 8, 16] as const;

export function isStandardPlayoffTeamCount(
  count: number | null | undefined,
): boolean {
  return (
    count === 4 ||
    count === 8 ||
    count === 16
  );
}

/** Single-elim winners-bracket matchups only — bulk round ops ignore losers/GF. */
export function winnersBracketMatchups(
  matchups: PlayoffMatchupDto[],
): PlayoffMatchupDto[] {
  return matchups.filter((m) => (m.bracketType ?? "winners") === "winners");
}

/** Lowest round that still has an unresolved non-bye matchup; null when decided. */
export function minimumUnresolvedRound(
  matchups: PlayoffMatchupDto[],
  totalRounds: number,
): number | null {
  const winners = winnersBracketMatchups(matchups);
  for (let round = 1; round <= totalRounds; round++) {
    const roundMatchups = winners.filter((m) => m.round === round);
    if (roundMatchups.some((m) => !m.isBye && !m.winnerTeamId)) {
      return round;
    }
  }
  return null;
}

export function championshipRound(totalRounds: number): number {
  return totalRounds;
}

export function isChampionshipRound(
  round: number,
  totalRounds: number,
): boolean {
  return round === championshipRound(totalRounds);
}

/** Playable (non-bye, undecided) matchups in a single-elim round. */
export function playableMatchupsInRound(
  matchups: PlayoffMatchupDto[],
  round: number,
): PlayoffMatchupDto[] {
  return winnersBracketMatchups(matchups).filter(
    (m) =>
      m.round === round &&
      !m.isBye &&
      !m.winnerTeamId &&
      m.fixtureId != null,
  );
}

export function fixtureIdsForRound(
  matchups: PlayoffMatchupDto[],
  round: number,
): string[] {
  return playableMatchupsInRound(matchups, round)
    .map((m) => m.fixtureId)
    .filter((id): id is string => id != null);
}

/** Bulk single-elim round simulation is unsupported for double elimination. */
export function supportsBulkPlayoffOps(format: string): boolean {
  return format !== "double";
}

export function canStartPlayoffs(
  playoffTeams: number | null | undefined,
): boolean {
  return isStandardPlayoffTeamCount(playoffTeams);
}

export type PlayoffPagePhase =
  | "no_playoffs_config"
  | "invalid_playoff_size"
  | "in_progress"
  | "ready"
  | "bracket_live";

export function playoffPagePhase(input: {
  playoffTeams: number | null | undefined;
  bracketExists: boolean;
  regularComplete: boolean;
}): PlayoffPagePhase {
  if (!input.playoffTeams || input.playoffTeams < 2) {
    return "no_playoffs_config";
  }
  if (input.bracketExists) return "bracket_live";
  if (!isStandardPlayoffTeamCount(input.playoffTeams)) {
    return "invalid_playoff_size";
  }
  if (input.regularComplete) return "ready";
  return "in_progress";
}

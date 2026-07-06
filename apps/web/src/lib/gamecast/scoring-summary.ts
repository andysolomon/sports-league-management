import type { PbpGameLog, PbpPlay } from "@/lib/pbp";
import type { PlayRevealIndex } from "./reveal";

export type ScoringPlayKind = "touchdown" | "field_goal";

export interface ScoringSummaryEntry {
  team: string;
  quarter: number;
  clockSeconds: number;
  kind: ScoringPlayKind;
  points: number;
  homeScore: number;
  awayScore: number;
}

function scoringKind(play: PbpPlay): ScoringPlayKind | null {
  if (!play.isScoring) return null;
  if (play.playType === "extra_point" || play.playType === "extra_point_miss") {
    return null;
  }
  if (play.playType === "field_goal") return "field_goal";
  if (play.pointsScored === 6) return "touchdown";
  return null;
}

export function scoringSummaryAtPosition(
  log: PbpGameLog,
  plays: PbpPlay[],
  playIndex: PlayRevealIndex,
): ScoringSummaryEntry[] {
  const entries: ScoringSummaryEntry[] = [];
  let homeScore = 0;
  let awayScore = 0;
  const end = Math.min(playIndex, plays.length);

  for (let i = 0; i < end; i++) {
    const play = plays[i];
    const kind = scoringKind(play);
    if (!kind) continue;

    // Fold a revealed, made extra point into its touchdown row so the
    // running score stays consistent with scoreAtPosition (extra points
    // are not listed as separate entries).
    let points = play.pointsScored;
    if (kind === "touchdown") {
      const next = plays[i + 1];
      if (i + 1 < end && next?.playType === "extra_point" && next.isScoring) {
        points += next.pointsScored;
      }
    }

    if (play.offenseTeamId === log.homeTeamId) homeScore += points;
    else if (play.offenseTeamId === log.awayTeamId) awayScore += points;

    entries.push({
      team: play.offenseTeamId,
      quarter: play.quarter,
      clockSeconds: play.clockSeconds,
      kind,
      points,
      homeScore,
      awayScore,
    });
  }

  return entries;
}

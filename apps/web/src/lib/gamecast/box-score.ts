import type { PbpGameLog, PbpPlay, PbpPlayType } from "@/lib/pbp";
import { scoreAtPosition, type PlayRevealIndex } from "./reveal";

export interface TeamBoxScoreLine {
  pass: number;
  rush: number;
  total: number;
  first: number;
  to: number;
  plays: number;
  pts: number;
}

export interface BoxScoreAtPosition {
  home: TeamBoxScoreLine;
  away: TeamBoxScoreLine;
}

const SCRIMMAGE_PLAY_TYPES = new Set<PbpPlayType>([
  "rush",
  "pass_complete",
  "pass_incomplete",
  "sack",
  "interception",
  "kneel",
]);

function emptyLine(): TeamBoxScoreLine {
  return { pass: 0, rush: 0, total: 0, first: 0, to: 0, plays: 0, pts: 0 };
}

function isScrimmagePlay(play: PbpPlay): boolean {
  return SCRIMMAGE_PLAY_TYPES.has(play.playType);
}

function applyPlayToLine(line: TeamBoxScoreLine, play: PbpPlay): void {
  if (play.playType === "pass_complete" || play.playType === "sack") {
    line.pass += play.yardsGained;
  } else if (play.playType === "rush" && !play.isTurnover) {
    line.rush += play.yardsGained;
  }

  if (play.isTurnover) line.to += 1;

  if (
    (play.playType === "rush" || play.playType === "pass_complete") &&
    play.yardsGained >= play.distance
  ) {
    line.first += 1;
  }

  if (isScrimmagePlay(play)) line.plays += 1;
}

export function boxScoreAtPosition(
  log: PbpGameLog,
  plays: PbpPlay[],
  playIndex: PlayRevealIndex,
): BoxScoreAtPosition {
  const home = emptyLine();
  const away = emptyLine();
  const end = Math.min(playIndex, plays.length);

  for (let i = 0; i < end; i++) {
    const play = plays[i];
    const line =
      play.offenseTeamId === log.homeTeamId
        ? home
        : play.offenseTeamId === log.awayTeamId
          ? away
          : null;
    if (!line) continue;
    applyPlayToLine(line, play);
  }

  home.total = home.pass + home.rush;
  away.total = away.pass + away.rush;

  const score = scoreAtPosition(log, plays, playIndex);
  home.pts = score.home;
  away.pts = score.away;

  return { home, away };
}

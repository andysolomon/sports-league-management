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
  /*
   * Accepted penalties charged to this team, and their yardage (A2).
   *
   * `null` means the log's engine did not model penalties at all — a v1 game.
   * That is NOT the same as a clean game, so the UI must render "—" rather
   * than "0". Claiming zero penalties for a game nobody counted would be a
   * fabricated stat, and Epic D's record book reads these numbers as history.
   */
  penalties: number | null;
  penaltyYards: number | null;
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
  // A spike is a snap that used a down, so it counts like a kneel does. A
  // timeout is not a play and an onside kick is not from scrimmage.
  "spike",
]);

function emptyLine(modelsPenalties: boolean): TeamBoxScoreLine {
  return {
    pass: 0,
    rush: 0,
    total: 0,
    first: 0,
    to: 0,
    plays: 0,
    pts: 0,
    penalties: modelsPenalties ? 0 : null,
    penaltyYards: modelsPenalties ? 0 : null,
  };
}

/**
 * Did this log's engine model penalties at all?
 *
 * Presence of any `penalty` field is the signal. A v2 game that happened to
 * draw no flags still reports 0 rather than "—", because it was counted.
 */
export function logModelsPenalties(log: PbpGameLog): boolean {
  return log.drives.some((drive) =>
    drive.plays.some((play) => play.penalty !== undefined),
  );
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

/** Charge an accepted flag to the team that committed it. */
function applyPenaltyToLines(
  home: TeamBoxScoreLine,
  away: TeamBoxScoreLine,
  play: PbpPlay,
  homeTeamId: string,
): void {
  const flag = play.penalty;
  // Declined flags cost nobody yardage, so they are not charged.
  if (!flag || !flag.accepted) return;

  const offendingTeamId = flag.onOffense
    ? play.offenseTeamId
    : play.defenseTeamId;
  const line = offendingTeamId === homeTeamId ? home : away;
  if (line.penalties !== null) line.penalties += 1;
  if (line.penaltyYards !== null) line.penaltyYards += flag.yards;
}

export function boxScoreAtPosition(
  log: PbpGameLog,
  plays: PbpPlay[],
  playIndex: PlayRevealIndex,
): BoxScoreAtPosition {
  const modelsPenalties = logModelsPenalties(log);
  const home = emptyLine(modelsPenalties);
  const away = emptyLine(modelsPenalties);
  const end = Math.min(playIndex, plays.length);

  for (let i = 0; i < end; i++) {
    const play = plays[i];
    // A flag is charged to whoever committed it, which may be the DEFENSE —
    // so this runs outside the offense-only branch below.
    applyPenaltyToLines(home, away, play, log.homeTeamId);

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

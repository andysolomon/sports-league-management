import type { PbpGameLog, PbpPlay } from "@/lib/pbp";

export interface ScoreAtPosition {
  home: number;
  away: number;
}

export interface GameClockAtPosition {
  quarter: number;
  clockSeconds: number;
}

/** Number of revealed plays (0 = pre-kickoff, length = full game). */
export type PlayRevealIndex = number;

export function formatGameClock(clockSeconds: number): string {
  const m = Math.floor(clockSeconds / 60);
  const s = clockSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function formatQuarterLabel(quarter: number): string {
  if (quarter <= 4) return `Q${quarter}`;
  return `OT${quarter - 4}`;
}

export function scoreAtPosition(
  log: PbpGameLog,
  plays: PbpPlay[],
  playIndex: PlayRevealIndex,
): ScoreAtPosition {
  let home = 0;
  let away = 0;
  const end = Math.min(playIndex, plays.length);
  for (let i = 0; i < end; i++) {
    const play = plays[i];
    if (!play.isScoring) continue;
    if (play.offenseTeamId === log.homeTeamId) home += play.pointsScored;
    else if (play.offenseTeamId === log.awayTeamId) away += play.pointsScored;
  }
  return { home, away };
}

export function clockAtPosition(
  plays: PbpPlay[],
  playIndex: PlayRevealIndex,
): GameClockAtPosition | null {
  if (playIndex <= 0 || plays.length === 0) return null;
  const play = plays[Math.min(playIndex, plays.length) - 1];
  return { quarter: play.quarter, clockSeconds: play.clockSeconds };
}

export function nextPlayIndex(
  current: PlayRevealIndex,
  totalPlays: number,
): PlayRevealIndex {
  return Math.min(current + 1, totalPlays);
}

export function nextQuarterIndex(
  plays: PbpPlay[],
  current: PlayRevealIndex,
): PlayRevealIndex {
  if (plays.length === 0) return 0;

  let targetQuarter: number;
  if (current === 0) {
    targetQuarter = plays[0].quarter;
  } else {
    const revealedQuarter = plays[current - 1].quarter;
    const hasMoreInQuarter =
      current < plays.length && plays[current].quarter === revealedQuarter;
    targetQuarter = hasMoreInQuarter ? revealedQuarter : revealedQuarter + 1;
  }

  let i = 0;
  while (i < plays.length && plays[i].quarter <= targetQuarter) i++;
  return i;
}

export function nextHalfIndex(
  plays: PbpPlay[],
  current: PlayRevealIndex,
): PlayRevealIndex {
  if (plays.length === 0) return 0;

  let targetMaxQuarter: number;
  if (current === 0) {
    targetMaxQuarter = 2;
  } else {
    const q = plays[current - 1].quarter;
    if (q <= 2) {
      const hasMoreInFirstHalf =
        current < plays.length && plays[current].quarter <= 2;
      targetMaxQuarter = hasMoreInFirstHalf ? 2 : 4;
    } else if (q <= 4) {
      targetMaxQuarter = 4;
    } else {
      return plays.length;
    }
  }

  let i = 0;
  while (i < plays.length && plays[i].quarter <= targetMaxQuarter) i++;
  return i;
}

export function entireGameIndex(totalPlays: number): PlayRevealIndex {
  return totalPlays;
}

export function restartIndex(): PlayRevealIndex {
  return 0;
}

export function revealedPlays(
  plays: PbpPlay[],
  playIndex: PlayRevealIndex,
): PbpPlay[] {
  return plays.slice(0, Math.min(playIndex, plays.length));
}

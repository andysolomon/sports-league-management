import type { PbpGameLog, PbpPlay } from "@/lib/pbp";
import { clockAtPosition, scoreAtPosition, type PlayRevealIndex } from "./reveal";

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function computeWinProbability(
  log: PbpGameLog,
  homeScore: number,
  awayScore: number,
  quarter: number,
  clockSeconds: number,
  offenseTeamId: string,
): number {
  const secLeft = Math.max(0, (4 - quarter) * 900 + clockSeconds);
  const margin = homeScore - awayScore;

  if (secLeft <= 0) {
    if (margin > 0) return 99;
    if (margin < 0) return 1;
    return 50;
  }

  const posVal = offenseTeamId === log.homeTeamId ? 0.7 : -0.7;
  const z =
    (margin + posVal) /
    (1.45 * Math.sqrt(Math.max(secLeft / 60, 0.2)) + 0.4);
  const p = 1 / (1 + Math.exp(-z));
  return Math.round(clamp(p * 100, 2, 98));
}

export function winProbabilityAtPosition(
  log: PbpGameLog,
  plays: PbpPlay[],
  playIndex: PlayRevealIndex,
): number {
  if (playIndex <= 0 || plays.length === 0) return 50;

  const { home, away } = scoreAtPosition(log, plays, playIndex);

  if (playIndex >= plays.length) {
    if (home > away) return 99;
    if (home < away) return 1;
    return 50;
  }

  const clock = clockAtPosition(plays, playIndex);
  if (!clock) return 50;

  const offenseTeamId = plays[playIndex - 1].offenseTeamId;

  return computeWinProbability(
    log,
    home,
    away,
    clock.quarter,
    clock.clockSeconds,
    offenseTeamId,
  );
}

export function winProbabilitySeries(
  log: PbpGameLog,
  plays: PbpPlay[],
): number[] {
  const series: number[] = [50];
  for (let i = 1; i <= plays.length; i++) {
    series.push(winProbabilityAtPosition(log, plays, i));
  }
  return series;
}

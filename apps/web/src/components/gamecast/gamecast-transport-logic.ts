import type { PbpPlay } from "@/lib/pbp";
import {
  entireGameIndex,
  nextHalfIndex,
  nextPlayIndex,
  nextQuarterIndex,
  prevHalfIndex,
  prevPlayIndex,
  prevQuarterIndex,
  restartIndex,
} from "@/lib/gamecast";
import type { GamecastSpeed } from "./useAutoAdvance";

export type GamecastMode = "sim" | "review";

export const GAMECAST_SPEEDS: GamecastSpeed[] = [0.5, 1, 2, 4];

export function isBackTransportDisabled(playIndex: number): boolean {
  return playIndex <= 0;
}

export function isForwardTransportDisabled(
  playIndex: number,
  totalPlays: number,
): boolean {
  return playIndex >= totalPlays;
}

export function handlePlayPauseClick(
  playIndex: number,
  totalPlays: number,
  playing: boolean,
  onPlayIndexChange: (next: number) => void,
  onPlayingChange: (playing: boolean) => void,
): void {
  if (playIndex >= totalPlays) {
    onPlayIndexChange(restartIndex());
    onPlayingChange(true);
    return;
  }
  onPlayingChange(!playing);
}

export function handleModeChange(
  mode: GamecastMode,
  onModeChange: (mode: GamecastMode) => void,
  onPlayingChange: (playing: boolean) => void,
): void {
  onPlayingChange(false);
  onModeChange(mode);
}

export function transportIndexHandlers(
  plays: PbpPlay[],
  totalPlays: number,
) {
  return {
    restart: () => restartIndex(),
    prevHalf: (i: number) => prevHalfIndex(plays, i),
    prevQuarter: (i: number) => prevQuarterIndex(plays, i),
    prevPlay: (i: number) => prevPlayIndex(i),
    nextPlay: (i: number) => nextPlayIndex(i, totalPlays),
    nextQuarter: (i: number) => nextQuarterIndex(plays, i),
    nextHalf: (i: number) => nextHalfIndex(plays, i),
    entireGame: () => entireGameIndex(totalPlays),
  };
}

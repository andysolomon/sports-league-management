"use client";

import { useEffect, useRef } from "react";

export type GamecastSpeed = 0.5 | 1 | 2 | 4;

export const AUTO_ADVANCE_MS = 950;

export function getAutoAdvanceIntervalMs(speed: GamecastSpeed): number {
  return AUTO_ADVANCE_MS / speed;
}

export interface UseAutoAdvanceOptions {
  playing: boolean;
  speed: GamecastSpeed;
  playIndex: number;
  totalPlays: number;
  onPlayIndexChange: (next: number) => void;
  onComplete?: () => void;
}

/** Schedules one-play ticks while `playing`; testable without React. */
export function scheduleAutoAdvance({
  playing,
  speed,
  getPlayIndex,
  totalPlays,
  onPlayIndexChange,
  onComplete,
}: {
  playing: boolean;
  speed: GamecastSpeed;
  getPlayIndex: () => number;
  totalPlays: number;
  onPlayIndexChange: (next: number) => void;
  onComplete?: () => void;
}): () => void {
  if (!playing) {
    return () => {};
  }

  const intervalMs = getAutoAdvanceIntervalMs(speed);
  const id = setInterval(() => {
    const current = getPlayIndex();
    if (current >= totalPlays) {
      return;
    }
    const next = current + 1;
    onPlayIndexChange(next);
    if (next >= totalPlays) {
      onComplete?.();
    }
  }, intervalMs);

  return () => clearInterval(id);
}

export function useAutoAdvance({
  playing,
  speed,
  playIndex,
  totalPlays,
  onPlayIndexChange,
  onComplete,
}: UseAutoAdvanceOptions): void {
  const playIndexRef = useRef(playIndex);
  const onPlayIndexChangeRef = useRef(onPlayIndexChange);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    playIndexRef.current = playIndex;
  }, [playIndex]);

  useEffect(() => {
    onPlayIndexChangeRef.current = onPlayIndexChange;
  }, [onPlayIndexChange]);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    return scheduleAutoAdvance({
      playing,
      speed,
      getPlayIndex: () => playIndexRef.current,
      totalPlays,
      onPlayIndexChange: (next) => onPlayIndexChangeRef.current(next),
      onComplete: onCompleteRef.current
        ? () => onCompleteRef.current?.()
        : undefined,
    });
  }, [playing, speed, totalPlays]);
}

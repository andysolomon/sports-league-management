/*
 * Pure presentational helpers for the public live score (WSM-000152 / overlay
 * WSM-000145). Kept out of the client components so the branchy display logic is
 * unit-testable in the repo's node test env (no DOM), like lib/liveScore and
 * lib/standings. The components stay thin: poll via useLiveScore, then render.
 */

import type { LiveScorePublic } from "./use-live-score";

/**
 * Should the live UI (card or overlay) show anything? No state yet, or the game
 * is final (handed back to the page's canonical Final card) → render nothing.
 */
export function isLiveVisible(live: LiveScorePublic | null): boolean {
  return live !== null && live.status !== "final";
}

/** Compact period/clock tag for the on-video overlay: "Q2 03:21", "Q3", "Half". */
export function overlayPeriodLabel(live: LiveScorePublic): string {
  if (live.status === "halftime") return "Half";
  if (live.clock) return `Q${live.period} ${live.clock}`;
  return `Q${live.period}`;
}

/** Status word for the standalone scoreboard card. */
export function cardStatusLabel(live: LiveScorePublic): string {
  return live.status === "halftime" ? "Halftime" : "Live";
}

/** First 3 letters, upper-cased — a compact, recognizable team tag for the chip. */
export function abbreviateTeam(name: string): string {
  return name.trim().slice(0, 3).toUpperCase();
}

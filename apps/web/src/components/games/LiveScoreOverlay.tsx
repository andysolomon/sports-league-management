"use client";

import { useLiveScore, type LiveScorePublic } from "@/lib/use-live-score";
import {
  isLiveVisible,
  overlayPeriodLabel,
  abbreviateTeam,
} from "@/lib/live-score-view";

interface LiveScoreOverlayProps {
  leagueId: string;
  gameId: string;
  homeTeamName: string;
  awayTeamName: string;
  initial: LiveScorePublic | null;
}

/*
 * Live-score overlay on the game stream (WSM-000145, child of streaming epic
 * #225) — the "video + score in one screen" GameChanger hook. A DOM overlay
 * layered over the Mux player (cheaper than server-side burn-in), fed the public
 * live game-state via useLiveScore (polls the public route, pauses on hidden
 * tabs). It is purely presentational:
 *   - `pointer-events-none` so it never traps focus or covers the player controls
 *   - `aria-live="polite"` so screen readers hear score/period changes
 *   - renders NOTHING when there's no live state (degrade-cleanly AC) or final
 *
 * Mount it inside a `relative` wrapper around <GameStreamPlayer>, only while the
 * stream is active. Short team abbreviations keep the chip unobtrusive.
 */
export default function LiveScoreOverlay({
  leagueId,
  gameId,
  homeTeamName,
  awayTeamName,
  initial,
}: LiveScoreOverlayProps) {
  const live = useLiveScore(leagueId, gameId, initial);

  // Degrade cleanly: no live state (or final) → no overlay, just video.
  if (!isLiveVisible(live) || !live) return null;

  const periodLabel = overlayPeriodLabel(live);

  return (
    <div
      className="pointer-events-none absolute left-3 top-3 z-10"
      aria-live="polite"
      aria-label={`Live score: ${homeTeamName} ${live.homeScore}, ${awayTeamName} ${live.awayScore}, ${periodLabel}`}
    >
      <div className="flex items-stretch overflow-hidden rounded-md bg-black/75 text-xs font-medium text-white shadow-lg backdrop-blur-sm">
        <div className="flex items-center gap-1.5 px-2.5 py-1.5">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
          <span className="tabular-nums">
            <span className="text-white/70">{abbreviateTeam(homeTeamName)}</span>{" "}
            <span className="font-bold">{live.homeScore}</span>
          </span>
          <span className="text-white/40">·</span>
          <span className="tabular-nums">
            <span className="text-white/70">{abbreviateTeam(awayTeamName)}</span>{" "}
            <span className="font-bold">{live.awayScore}</span>
          </span>
        </div>
        <div className="flex items-center bg-white/10 px-2.5 py-1.5 font-mono uppercase tracking-wide tabular-nums">
          {periodLabel}
        </div>
      </div>
    </div>
  );
}

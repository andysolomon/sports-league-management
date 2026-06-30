"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/*
 * Client polling for public live game-state (WSM-000152 / overlay WSM-000145).
 *
 * There is no browser Convex client in this app (Convex is admin-keyed,
 * server-side only), so live state can't use a reactive useQuery — it polls the
 * public route `/leagues/[id]/games/[gameId]/live-score` instead. Shared by the
 * standalone scoreboard card and the on-video overlay so the fetch/visibility/
 * final-handoff logic lives in one place.
 *
 * Guardrails: polls only while the tab is VISIBLE (pauses on a hidden tab to
 * bound request volume), and stops once the game is "final" — handing off to the
 * server page's canonical Final card via a one-time router.refresh().
 */

export interface LiveScorePublic {
  homeScore: number;
  awayScore: number;
  period: number;
  clock: string | null;
  status: string;
}

export function useLiveScore(
  leagueId: string,
  gameId: string,
  initial: LiveScorePublic | null,
  // 10s cadence (was 5s): a scoreboard reads fine at 10s, and it halves poll
  // volume — paired with the route's single-call read + s-maxage=10 edge cache,
  // this cuts prod Convex function calls from this surface ~8x (WSM-000192).
  intervalMs = 10_000,
): LiveScorePublic | null {
  const router = useRouter();
  const [live, setLive] = useState<LiveScorePublic | null>(initial);
  const refreshedOnFinal = useRef(false);

  const isFinal = live?.status === "final";

  useEffect(() => {
    if (isFinal) {
      // Let the server page's Final card (from gameResults) take over once.
      if (!refreshedOnFinal.current) {
        refreshedOnFinal.current = true;
        router.refresh();
      }
      return;
    }

    let cancelled = false;
    async function poll() {
      // Pause while the tab is hidden — no point fetching a score nobody sees.
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch(
          `/leagues/${leagueId}/games/${gameId}/live-score`,
          { cache: "no-store" },
        );
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { live: LiveScorePublic | null };
        if (!cancelled) setLive(data.live);
      } catch {
        // Transient network error — keep the last known score, retry next tick.
      }
    }

    const interval = setInterval(poll, intervalMs);
    // Refresh immediately when the fan returns to the tab (don't wait a full tick).
    function onVisibility() {
      if (document.visibilityState === "visible") void poll();
    }
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [isFinal, leagueId, gameId, intervalMs, router]);

  return live;
}

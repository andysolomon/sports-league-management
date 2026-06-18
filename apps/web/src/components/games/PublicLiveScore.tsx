"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface LivePublic {
  homeScore: number;
  awayScore: number;
  period: number;
  clock: string | null;
  status: string;
}

interface PublicLiveScoreProps {
  leagueId: string;
  gameId: string;
  homeTeamName: string;
  awayTeamName: string;
  initial: LivePublic | null;
}

const POLL_MS = 5000;

/*
 * Public live scoreboard (WSM-000152). Polls the sibling `live-score` route
 * while the game is live and renders a running score. SSR seeds `initial` so
 * the first paint has the score with no flash; polling keeps it fresh. When the
 * operator ends the game the status flips to "final" — we stop polling and
 * refresh the server component so the page's canonical Final card takes over.
 */
export default function PublicLiveScore({
  leagueId,
  gameId,
  homeTeamName,
  awayTeamName,
  initial,
}: PublicLiveScoreProps) {
  const router = useRouter();
  const [live, setLive] = useState<LivePublic | null>(initial);
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
      try {
        const res = await fetch(
          `/leagues/${leagueId}/games/${gameId}/live-score`,
          { cache: "no-store" },
        );
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { live: LivePublic | null };
        if (!cancelled) setLive(data.live);
      } catch {
        // Transient network error — keep the last known score, try again next tick.
      }
    }

    const interval = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isFinal, leagueId, gameId, router]);

  // Nothing live yet, or already final (handed back to the server Final card).
  if (!live || isFinal) return null;

  return (
    <Card className="mb-6">
      <CardContent className="py-6">
        <div className="mb-3 flex justify-center">
          <Badge variant="destructive" className="gap-1.5">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-current" />
            LIVE
          </Badge>
        </div>
        <div className="flex items-center justify-around gap-4 text-center">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-muted-foreground">
              {homeTeamName}
            </p>
            <p className="text-5xl font-bold tabular-nums text-foreground">
              {live.homeScore}
            </p>
          </div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            <div className="font-semibold text-foreground">
              {live.status === "halftime" ? "Halftime" : "Live"}
            </div>
            <div className="mt-1">Period {live.period}</div>
            {live.clock ? (
              <div className="mt-1 font-mono tabular-nums">{live.clock}</div>
            ) : null}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-muted-foreground">
              {awayTeamName}
            </p>
            <p className="text-5xl font-bold tabular-nums text-foreground">
              {live.awayScore}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

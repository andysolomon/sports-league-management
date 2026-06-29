"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLiveScore, type LiveScorePublic } from "@/lib/use-live-score";
import { isLiveVisible, cardStatusLabel } from "@/lib/live-score-view";

interface PublicLiveScoreProps {
  leagueId: string;
  gameId: string;
  homeTeamName: string;
  awayTeamName: string;
  initial: LiveScorePublic | null;
}

/*
 * Public live scoreboard CARD (WSM-000152) — shown on the public game page for a
 * live game that has NO video stream. When a stream is active the on-video
 * overlay (LiveScoreOverlay, WSM-000145) carries the score instead and the page
 * suppresses this card. Polling/visibility/final-handoff live in useLiveScore.
 */
export default function PublicLiveScore({
  leagueId,
  gameId,
  homeTeamName,
  awayTeamName,
  initial,
}: PublicLiveScoreProps) {
  const live = useLiveScore(leagueId, gameId, initial);

  // Nothing live yet, or already final (handed back to the server Final card).
  if (!isLiveVisible(live) || !live) return null;

  return (
    <Card className="mb-6">
      <CardContent className="py-6">
        <div className="mb-3 flex justify-center">
          <Badge variant="success" className="gap-1.5">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-current" />
            LIVE
          </Badge>
        </div>
        <div className="flex items-center justify-around gap-4 text-center">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-muted-foreground">
              {homeTeamName}
            </p>
            <p className="font-mono text-5xl font-bold tabular-nums text-foreground">
              {live.homeScore}
            </p>
          </div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            <div className="font-semibold text-foreground">
              {cardStatusLabel(live)}
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
            <p className="font-mono text-5xl font-bold tabular-nums text-foreground">
              {live.awayScore}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

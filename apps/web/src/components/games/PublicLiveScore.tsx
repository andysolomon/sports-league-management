"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Scoreboard } from "@/components/live/Scoreboard";
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
        <Scoreboard
          homeTeamName={homeTeamName}
          awayTeamName={awayTeamName}
          homeScore={live.homeScore}
          awayScore={live.awayScore}
          status={live.status}
          period={live.period}
          clock={live.clock}
          statusLabel={cardStatusLabel(live)}
        />
      </CardContent>
    </Card>
  );
}

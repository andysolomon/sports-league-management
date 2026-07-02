import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { cache } from "react";
import { schedulesStandingsV1, liveStreamingV1, liveScoringV1 } from "@/lib/flags";
import {
  getFixture,
  getPublicLeagues,
  getPublicSeason,
  getResultByFixture,
  getStreamByFixture,
  getLiveGameState,
} from "@/lib/data-api";
import { publicLeagueGuard } from "@/lib/public-league-guard";
import { resolveStreamView } from "@/lib/stream-view";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import GameStreamPlayer from "@/components/games/GameStreamPlayer";
import PublicLiveScore from "@/components/games/PublicLiveScore";
import LiveScoreOverlay from "@/components/games/LiveScoreOverlay";

/*
 * Public game viewer route (WSM-000143, child of the streaming epic #225).
 *
 * NO Clerk session required — middleware whitelists `/leagues/(.*)`. Defense in
 * depth, in order:
 *   1. `schedulesStandingsV1` flag off → 404 (games are part of the same
 *      feature as the schedule/standings viewers it links from).
 *   2. `publicLeagueGuard` → 404 if the league isn't opt-in public.
 *   3. Cross-league guard: `getFixture` returns ANY fixture by id with no
 *      league check, so we resolve its season and 404 unless the season's
 *      leagueId matches the league in the URL. Without this, a fixture id from
 *      a PRIVATE league could be viewed by pairing it with a public league's
 *      path. All three reads are ungated and safe post-guard.
 *
 * `FixtureStatus` is "scheduled" | "final" | "cancelled". The in-progress state
 * lives separately in `liveGameState` (keystone v3, WSM-000152): while a game is
 * live the `PublicLiveScore` client component polls and shows a running score
 * above these three; on "End game" the operator writes the final to gameResults
 * and flips the fixture to "final", so the Final card below takes over.
 */

const kickoffFormat = new Intl.DateTimeFormat("en-US", {
  dateStyle: "full",
  timeStyle: "short",
});

function formatKickoff(iso: string | null): string {
  if (!iso) return "Date TBD";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "Date TBD" : kickoffFormat.format(date);
}

// Deduped across generateMetadata + the page render within one request.
const getPublicLeagueName = cache(async (leagueId: string) => {
  const leagues = await getPublicLeagues();
  return leagues.find((league) => league.id === leagueId)?.name ?? null;
});

const getGameView = cache(async (leagueId: string, gameId: string) => {
  const fixture = await getFixture(gameId);
  if (!fixture) return null;

  // Cross-league leak guard — the fixture must live in THIS public league.
  const season = await getPublicSeason(fixture.seasonId);
  if (!season || season.leagueId !== leagueId) return null;

  const result =
    fixture.status === "final" ? await getResultByFixture(gameId) : null;

  return { fixture, result, seasonName: season.name };
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; gameId: string }>;
}): Promise<Metadata> {
  const { id, gameId } = await params;
  const [view, leagueName] = await Promise.all([
    getGameView(id, gameId),
    getPublicLeagueName(id),
  ]);
  if (!view) return { title: "Game" };

  const matchup = `${view.fixture.homeTeamName} vs ${view.fixture.awayTeamName}`;
  const title = leagueName ? `${matchup} — ${leagueName}` : matchup;
  const description =
    view.result
      ? `Final: ${view.fixture.homeTeamName} ${view.result.homeScore} – ${view.result.awayScore} ${view.fixture.awayTeamName}.`
      : `${matchup} — ${formatKickoff(view.fixture.scheduledAt)}.`;
  return {
    title,
    description,
    openGraph: { title, description, type: "website" },
    twitter: { card: "summary", title, description },
  };
}

export default async function PublicGamePage({
  params,
}: {
  params: Promise<{ id: string; gameId: string }>;
}) {
  const enabled = await schedulesStandingsV1();
  if (!enabled) notFound();

  const { id: leagueId, gameId } = await params;
  await publicLeagueGuard(leagueId);

  const view = await getGameView(leagueId, gameId);
  if (!view) notFound();

  // Live streaming is a TRUE dark flag — OFF in every env unless opted in. When
  // off, the stream read is skipped and the page renders exactly as before.
  const streamingEnabled = await liveStreamingV1();
  // Fail-soft: a stream-read hiccup must not crash the public page — just hide
  // the player. (Incident hardening alongside the live-state read below.)
  const stream = streamingEnabled
    ? await getStreamByFixture(gameId).catch(() => null)
    : null;

  // Live scoring (WSM-000152): when on, seed the running scoreboard from the
  // server so first paint has the score; the client component then polls. Skip
  // entirely for already-final games — the Final card below is canonical.
  const liveEnabled = await liveScoringV1();
  const liveState =
    liveEnabled && view.fixture.status !== "final"
      ? await getLiveGameState(gameId).catch(() => null)
      : null;
  // Replay-vs-live decision (WSM-000198): live plays the live playback id;
  // an ended Mux stream replays the recorded asset's own public playback id
  // (vodPlaybackId); an ended YouTube stream replays the same video id.
  const streamView = resolveStreamView(stream);
  const liveActive = streamView.mode === "live";
  const hasReplay = streamView.mode === "replay";
  const streamEndedNoReplay = streamView.mode === "ended-no-replay";

  const { fixture, result, seasonName } = view;
  const isFinal = fixture.status === "final" && result !== null;
  const isCancelled = fixture.status === "cancelled";
  const homeWon = result !== null && result.homeScore > result.awayScore;
  const awayWon = result !== null && result.awayScore > result.homeScore;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Link
        href={`/leagues/${leagueId}`}
        className="mb-4 inline-block text-sm text-primary hover:underline"
      >
        &larr; Back to League
      </Link>

      <header className="mb-6">
        <p className="text-sm font-medium text-muted-foreground">
          {seasonName}
          {fixture.week !== null ? ` · Week ${fixture.week}` : ""}
        </p>
        <h1 className="text-2xl font-bold text-foreground">
          {fixture.homeTeamName} vs {fixture.awayTeamName}
        </h1>
      </header>

      {/* Standalone scoreboard card — only when there's NO active stream. With a
          stream, LiveScoreOverlay carries the score on the video instead (#302),
          so we don't show it twice. */}
      {liveEnabled && fixture.status !== "final" && !liveActive ? (
        <PublicLiveScore
          leagueId={leagueId}
          gameId={gameId}
          homeTeamName={fixture.homeTeamName}
          awayTeamName={fixture.awayTeamName}
          initial={liveState}
        />
      ) : null}

      {liveActive || hasReplay ? (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {liveActive ? (
                <>
                  <Badge variant="success">LIVE</Badge>
                  <span>Watch live</span>
                </>
              ) : (
                <span>Replay</span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <GameStreamPlayer
                provider={stream!.provider}
                muxPlaybackId={streamView.muxPlaybackId}
                youtubeVideoId={streamView.youtubeVideoId}
                live={liveActive}
                title={`${fixture.homeTeamName} vs ${fixture.awayTeamName}`}
              />
              {/* Live-score overlay (#302) — only over a live stream, and only
                  when live scoring is on. Self-degrades to nothing if the fixture
                  has no live game-state. */}
              {liveActive && liveEnabled ? (
                <LiveScoreOverlay
                  leagueId={leagueId}
                  gameId={gameId}
                  homeTeamName={fixture.homeTeamName}
                  awayTeamName={fixture.awayTeamName}
                  initial={liveState}
                />
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : streamEndedNoReplay ? (
        <Card className="mb-6">
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            The live stream has ended.
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>
            {isFinal ? "Final" : isCancelled ? "Cancelled" : "Scheduled"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isFinal ? (
            <div className="flex items-center justify-center gap-6 text-center">
              <div className="flex-1">
                <p
                  className={`text-sm ${homeWon ? "font-semibold text-foreground" : "text-muted-foreground"}`}
                >
                  {fixture.homeTeamName}
                </p>
                <p
                  className={`text-4xl font-bold tabular-nums ${homeWon ? "text-foreground" : "text-muted-foreground"}`}
                >
                  {result.homeScore}
                </p>
              </div>
              <span className="text-2xl text-muted-foreground">–</span>
              <div className="flex-1">
                <p
                  className={`text-sm ${awayWon ? "font-semibold text-foreground" : "text-muted-foreground"}`}
                >
                  {fixture.awayTeamName}
                </p>
                <p
                  className={`text-4xl font-bold tabular-nums ${awayWon ? "text-foreground" : "text-muted-foreground"}`}
                >
                  {result.awayScore}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-center text-sm text-muted-foreground">
              {isCancelled
                ? "This game was cancelled."
                : "This game hasn’t been played yet."}
            </p>
          )}

          <dl className="divide-y divide-border border-t border-border text-sm">
            <div className="flex justify-between py-2">
              <dt className="text-muted-foreground">Kickoff</dt>
              <dd className="text-foreground">
                {formatKickoff(fixture.scheduledAt)}
              </dd>
            </div>
            <div className="flex justify-between py-2">
              <dt className="text-muted-foreground">Venue</dt>
              <dd className="text-foreground">{fixture.venue ?? "TBD"}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}

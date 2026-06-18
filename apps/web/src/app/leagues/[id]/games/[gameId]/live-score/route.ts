import { NextResponse } from "next/server";
import { liveScoringV1 } from "@/lib/flags";
import {
  getFixture,
  getLeagueVisibility,
  getPublicSeason,
  getLiveGameState,
} from "@/lib/data-api";

/*
 * Public live game-state poll (WSM-000152, keystone v3). The seam #302's
 * live-score overlay consumes, and the public game page's scoreboard refreshes
 * against.
 *
 * NO Clerk session — it lives under `/leagues/(.*)`, which middleware (proxy.ts)
 * whitelists. Same defense-in-depth as the public game PAGE it sits beside:
 *   1. `live_scoring_v1` off → 404 (the feature doesn't exist in this env).
 *   2. league not opted-in public → 404.
 *   3. cross-league leak guard — `getFixture` resolves ANY fixture by id with
 *      no league check, so we 404 unless the fixture's season belongs to THIS
 *      public league. Prevents pairing a private fixture id with a public path.
 * Only after all three do we return the (non-sensitive) score projection.
 *
 * Response: `{ live: { homeScore, awayScore, period, clock, status } | null }`.
 * `live` is null before kickoff / when no live state exists yet — the overlay
 * polls and simply shows nothing until it appears.
 */

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; gameId: string }> },
) {
  const enabled = await liveScoringV1();
  if (!enabled) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const { id: leagueId, gameId } = await params;

  const visibility = await getLeagueVisibility(leagueId);
  if (!visibility || !visibility.isPublic) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const fixture = await getFixture(gameId);
  if (!fixture) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  // Cross-league leak guard — the fixture must live in THIS public league.
  const season = await getPublicSeason(fixture.seasonId);
  if (!season || season.leagueId !== leagueId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const live = await getLiveGameState(gameId);

  // Short-lived edge cache so a crowd refreshing doesn't hammer Convex, while
  // the score still feels live (≤5s stale). The overlay polls on its own cadence.
  return NextResponse.json(
    { live },
    {
      headers: {
        "Cache-Control": "public, max-age=0, s-maxage=3, stale-while-revalidate=5",
      },
    },
  );
}

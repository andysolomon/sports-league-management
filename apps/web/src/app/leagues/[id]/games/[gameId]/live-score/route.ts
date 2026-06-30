import { NextResponse } from "next/server";
import { liveScoringV1 } from "@/lib/flags";
import { getPublicLiveGameState } from "@/lib/data-api";

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

  // ONE Convex call does the public + cross-league leak guard AND the live-state
  // read (was four separate queries polled every few seconds — WSM-000192). A
  // null result means the guard failed; otherwise `{ live }` (live null = not
  // started yet). Invalid ids throw at Convex arg validation → treat as 404.
  let result: Awaited<ReturnType<typeof getPublicLiveGameState>>;
  try {
    result = await getPublicLiveGameState(leagueId, gameId);
  } catch {
    result = null;
  }
  if (!result) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Edge cache long enough to collapse a crowd's polls of the SAME game into ~one
  // Convex hit per window, aligned with the client's 10s cadence — while staying
  // live-feeling (stale-while-revalidate serves instantly and refreshes behind).
  return NextResponse.json(
    { live: result.live },
    {
      headers: {
        "Cache-Control":
          "public, max-age=0, s-maxage=10, stale-while-revalidate=20",
      },
    },
  );
}

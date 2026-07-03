import "server-only";
import { auth } from "@clerk/nextjs/server";
import { liveStreamingV1 } from "@/lib/flags";
import { getFixture, getPublicSeason } from "@/lib/data-api";
import { canAdministerTeam } from "@/lib/authorization";

/*
 * Shared auth chain for streaming server actions (WSM-000144; extracted for
 * reuse by the clip actions, WSM-000201). NOT a "use server" module — this is
 * a plain server-only helper, so it never becomes a client-callable action.
 *
 * Chain: dark flag on → Clerk session → caller administers EITHER the home or
 * away team (WSM-000121 team ownership) → fixture's season actually belongs to
 * the league in the URL (cross-league guard, mirrors the public page).
 */
export async function authorizeStreamAction(
  leagueId: string,
  fixtureId: string,
): Promise<
  | { ok: true; userId: string; fixtureStatus: string }
  | { ok: false; error: string }
> {
  const enabled = await liveStreamingV1();
  if (!enabled) return { ok: false, error: "flag_disabled" };

  const { userId } = await auth();
  if (!userId) return { ok: false, error: "unauthorized" };

  const fixture = await getFixture(fixtureId);
  if (!fixture) return { ok: false, error: "fixture_not_found" };

  // Cross-league guard: the fixture's season must live in THIS league.
  const season = await getPublicSeason(fixture.seasonId);
  if (!season || season.leagueId !== leagueId) {
    return { ok: false, error: "fixture_not_in_league" };
  }

  const [canHome, canAway] = await Promise.all([
    canAdministerTeam(fixture.homeTeamId, userId),
    canAdministerTeam(fixture.awayTeamId, userId),
  ]);
  if (!canHome && !canAway) return { ok: false, error: "not_authorized" };

  return { ok: true, userId, fixtureStatus: fixture.status };
}

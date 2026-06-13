import { cache } from "react";
import { cookies } from "next/headers";
import type { LeagueDto } from "@sports-management/shared-types";
import { resolveOrgContext, type OrgContext } from "./org-context";
import { getLeagues } from "./data-api";
import { ACTIVE_LEAGUE_COOKIE } from "./active-league-cookie";

/**
 * Global "active league" context (WSM-000103). The dashboard focuses on one
 * league at a time (Convex-deployment-switcher style); the active league is a
 * preference cookie, read server-side so SSR pages scope their queries without
 * a round-trip. Falls back to the first visible league.
 *
 * The cookie name is re-exported from the client-safe module so existing
 * server importers keep working; the client switcher imports it directly from
 * there to avoid pulling `next/headers` into the client bundle.
 */
export { ACTIVE_LEAGUE_COOKIE };

export interface ActiveLeagueContext {
  orgContext: OrgContext;
  /** The user's visible leagues, name-sorted (from getLeagues). */
  leagues: LeagueDto[];
  /** The active league id, or null when the user has no leagues. */
  activeLeagueId: string | null;
}

/**
 * Resolves the active league: the cookie value when it's still visible, else
 * the first visible league. Cached per request so the layout and the page that
 * renders inside it share one resolution.
 */
export const resolveActiveLeague = cache(
  async (userId: string): Promise<ActiveLeagueContext> => {
    const orgContext = await resolveOrgContext(userId);
    const leagues = await getLeagues(orgContext.visibleLeagueIds);
    const cookieVal = (await cookies()).get(ACTIVE_LEAGUE_COOKIE)?.value;
    // Default order (WSM-000105): an explicit switcher choice (cookie) wins;
    // otherwise prefer a league the user's org OWNS (their primary) over any
    // followed/subscribed public league; finally fall back to the first
    // visible league. `leagues` is name-sorted, so each pick is deterministic.
    const owned = leagues.filter(
      (l) => l.orgId !== null && orgContext.orgIds.includes(l.orgId),
    );
    const activeLeagueId =
      (cookieVal && leagues.some((l) => l.id === cookieVal)
        ? cookieVal
        : null) ??
      owned[0]?.id ??
      leagues[0]?.id ??
      null;
    return { orgContext, leagues, activeLeagueId };
  },
);

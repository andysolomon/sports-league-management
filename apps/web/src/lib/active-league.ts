import { cache } from "react";
import { cookies } from "next/headers";
import type { LeagueDto } from "@sports-management/shared-types";
import { resolveOrgContext, type OrgContext } from "./org-context";
import { getLeagues } from "./data-api";

/**
 * Global "active league" context (WSM-000103). The dashboard focuses on one
 * league at a time (Convex-deployment-switcher style); the active league is a
 * preference cookie, read server-side so SSR pages scope their queries without
 * a round-trip. Falls back to the first visible league.
 */
export const ACTIVE_LEAGUE_COOKIE = "activeLeagueId";

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
    const activeLeagueId =
      (cookieVal && leagues.some((l) => l.id === cookieVal) ? cookieVal : null) ??
      leagues[0]?.id ??
      null;
    return { orgContext, leagues, activeLeagueId };
  },
);

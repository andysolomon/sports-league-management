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
  /** The active league row, or null when the user has no leagues. */
  activeLeague: LeagueDto | null;
  /** Whether the persisted preference was usable for this request. */
  preferenceStatus: ActiveLeaguePreferenceStatus;
  /** The raw cookie value, when one was sent. */
  preferredLeagueId: string | null;
}

export type ActiveLeaguePreferenceStatus = "valid" | "missing" | "stale" | "none";

export interface ActiveLeagueSelection {
  activeLeagueId: string | null;
  activeLeague: LeagueDto | null;
  status: ActiveLeaguePreferenceStatus;
}

export function selectActiveLeaguePreference({
  leagues,
  orgContext,
  preferredLeagueId,
}: {
  leagues: LeagueDto[];
  orgContext: Pick<OrgContext, "orgIds">;
  preferredLeagueId: string | null | undefined;
}): ActiveLeagueSelection {
  if (leagues.length === 0) {
    return {
      activeLeagueId: null,
      activeLeague: null,
      status: preferredLeagueId ? "stale" : "none",
    };
  }

  const preferred =
    preferredLeagueId ?
      leagues.find((league) => league.id === preferredLeagueId) ?? null
    : null;
  if (preferred) {
    return {
      activeLeagueId: preferred.id,
      activeLeague: preferred,
      status: "valid",
    };
  }

  const owned =
    leagues.find(
      (league) => league.orgId !== null && orgContext.orgIds.includes(league.orgId),
    ) ?? null;
  const fallback = owned ?? leagues[0] ?? null;

  return {
    activeLeagueId: fallback?.id ?? null,
    activeLeague: fallback,
    status: preferredLeagueId ? "stale" : "missing",
  };
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
    const preferredLeagueId =
      (await cookies()).get(ACTIVE_LEAGUE_COOKIE)?.value ?? null;
    const selection = selectActiveLeaguePreference({
      leagues,
      orgContext,
      preferredLeagueId,
    });

    return {
      orgContext,
      leagues,
      activeLeagueId: selection.activeLeagueId,
      activeLeague: selection.activeLeague,
      preferenceStatus: selection.status,
      preferredLeagueId,
    };
  },
);

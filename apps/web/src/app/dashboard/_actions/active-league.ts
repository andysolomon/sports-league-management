"use server";

import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { getLeague } from "@/lib/data-api";
import { resolveOrgContext } from "@/lib/org-context";
import {
  ACTIVE_LEAGUE_COOKIE,
  ACTIVE_LEAGUE_COOKIE_OPTIONS,
  leagueHomePath,
} from "@/lib/active-league-cookie";

export interface SetActiveLeagueResult {
  ok: boolean;
  redirectTo: string | null;
}

export async function setActiveLeaguePreferenceAction(
  leagueId: string,
): Promise<SetActiveLeagueResult> {
  const { userId } = await auth();
  if (!userId) return { ok: false, redirectTo: null };

  const orgContext = await resolveOrgContext(userId);
  const league = await getLeague(leagueId, orgContext).catch(() => null);
  if (!league) return { ok: false, redirectTo: null };

  (await cookies()).set(
    ACTIVE_LEAGUE_COOKIE,
    league.id,
    ACTIVE_LEAGUE_COOKIE_OPTIONS,
  );

  return { ok: true, redirectTo: leagueHomePath(league.id) };
}

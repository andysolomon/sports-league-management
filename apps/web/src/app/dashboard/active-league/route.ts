import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getLeague } from "@/lib/data-api";
import { resolveActiveLeague } from "@/lib/active-league";
import { resolveOrgContext } from "@/lib/org-context";
import {
  ACTIVE_LEAGUE_COOKIE,
  ACTIVE_LEAGUE_COOKIE_OPTIONS,
  leagueHomePath,
  normalizeDashboardReturnPath,
} from "@/lib/active-league-cookie";

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const url = new URL(request.url);
  const targetLeagueId = url.searchParams.get("leagueId");
  const returnTo = normalizeDashboardReturnPath(url.searchParams.get("returnTo"));
  const cookieStore = await cookies();

  if (targetLeagueId) {
    const orgContext = await resolveOrgContext(userId);
    const league = await getLeague(targetLeagueId, orgContext).catch(() => null);
    if (league) {
      cookieStore.set(
        ACTIVE_LEAGUE_COOKIE,
        league.id,
        ACTIVE_LEAGUE_COOKIE_OPTIONS,
      );
    }
    redirect(returnTo);
  }

  const context = await resolveActiveLeague(userId);
  if (context.activeLeagueId) {
    cookieStore.set(
      ACTIVE_LEAGUE_COOKIE,
      context.activeLeagueId,
      ACTIVE_LEAGUE_COOKIE_OPTIONS,
    );
    redirect(leagueHomePath(context.activeLeagueId));
  }

  cookieStore.delete(ACTIVE_LEAGUE_COOKIE);
  redirect(returnTo === "/dashboard" ? "/dashboard/leagues" : returnTo);
}

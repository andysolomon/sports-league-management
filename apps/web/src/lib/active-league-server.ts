import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  ACTIVE_LEAGUE_COOKIE,
  DASHBOARD_PATH_HEADER,
  normalizeDashboardReturnPath,
} from "./active-league-cookie";

export async function currentDashboardPath(): Promise<string> {
  return normalizeDashboardReturnPath(
    (await headers()).get(DASHBOARD_PATH_HEADER),
  );
}

export async function syncActiveLeagueForResource(
  leagueId: string,
): Promise<void> {
  const current = (await cookies()).get(ACTIVE_LEAGUE_COOKIE)?.value ?? null;
  if (current === leagueId) return;

  const returnTo = await currentDashboardPath();
  const params = new URLSearchParams({ leagueId, returnTo });
  redirect(`/dashboard/active-league?${params.toString()}`);
}

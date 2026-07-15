/**
 * The active-league preference cookie name. Lives in its own module — with NO
 * server-only imports — so both the server resolver (active-league.ts, which
 * imports `next/headers`) and the client switcher can share it without dragging
 * `next/headers` into the client bundle (WSM-000103 build fix).
 */
export const ACTIVE_LEAGUE_COOKIE = "activeLeagueId";

export const ACTIVE_LEAGUE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export const ACTIVE_LEAGUE_COOKIE_OPTIONS = {
  httpOnly: true,
  maxAge: ACTIVE_LEAGUE_COOKIE_MAX_AGE,
  path: "/",
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
};

export const DASHBOARD_PATH_HEADER = "x-dashboard-path";

export function leagueHomePath(leagueId: string): string {
  return `/dashboard/leagues/${encodeURIComponent(leagueId)}`;
}

export function normalizeDashboardReturnPath(
  input: string | null | undefined,
): string {
  if (!input) return "/dashboard";
  if (!input.startsWith("/dashboard") || input.startsWith("//")) {
    return "/dashboard";
  }

  try {
    const url = new URL(input, "http://dashboard.local");
    if (url.origin !== "http://dashboard.local") return "/dashboard";
    if (
      url.pathname !== "/dashboard" &&
      !url.pathname.startsWith("/dashboard/")
    ) {
      return "/dashboard";
    }
    return `${url.pathname}${url.search}`;
  } catch {
    return "/dashboard";
  }
}

export function isActiveLeagueResourcePath(pathname: string): boolean {
  return [
    /^\/dashboard\/leagues\/[^/]+(?:\/.*)?$/,
    /^\/dashboard\/teams\/[^/]+(?:\/.*)?$/,
    /^\/dashboard\/players\/[^/]+(?:\/.*)?$/,
    /^\/dashboard\/seasons\/[^/]+(?:\/.*)?$/,
    /^\/dashboard\/divisions\/[^/]+(?:\/.*)?$/,
    /^\/dashboard\/games\/[^/]+(?:\/.*)?$/,
  ].some((pattern) => pattern.test(pathname));
}

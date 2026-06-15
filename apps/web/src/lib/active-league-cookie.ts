/**
 * The active-league preference cookie name. Lives in its own module — with NO
 * server-only imports — so both the server resolver (active-league.ts, which
 * imports `next/headers`) and the client switcher can share it without dragging
 * `next/headers` into the client bundle (WSM-000103 build fix).
 */
export const ACTIVE_LEAGUE_COOKIE = "activeLeagueId";

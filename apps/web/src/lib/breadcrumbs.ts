/**
 * Pure pathname → breadcrumb trail (WSM-000136 P2).
 *
 * Builds a crumb for each KNOWN route segment, accumulating the href across all
 * segments (so dynamic `[id]` segments stay in the links but contribute no
 * visible crumb — we don't have entity names client-side here). The last crumb
 * is the current page.
 */
export interface Crumb {
  label: string;
  href: string;
}

const SEGMENT_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  leagues: "Leagues",
  teams: "Teams",
  players: "Players",
  seasons: "Seasons",
  divisions: "Divisions",
  discover: "Discover",
  import: "Import",
  billing: "Billing",
  roles: "Roles",
  members: "Members",
  roster: "Roster",
  standings: "Standings",
  schedule: "Schedule",
  format: "Format",
  requests: "Requests",
  development: "Development",
  "depth-chart": "Depth chart",
};

export function breadcrumbsForPath(pathname: string): Crumb[] {
  const segments = pathname.split("/").filter(Boolean);
  const crumbs: Crumb[] = [];
  let href = "";
  for (const segment of segments) {
    href += `/${segment}`;
    const label = SEGMENT_LABELS[segment];
    if (label) crumbs.push({ label, href });
  }
  return crumbs;
}

import { teamRegions, type TeamLoc } from "@/lib/geo";
import { buildBasemap } from "@/lib/geo-basemap";

const W = 320;
const H = 200;

/**
 * League geography (WSM-000136 P5-b): a real US basemap (AlbersUSA state
 * outlines, via d3-geo + a bundled topojson) with team markers placed by their
 * city (the bundled coordinate lookup), beside a Vercel-style regions list
 * (teams per state/metro). Teams whose city we can't geocode still count in the
 * regions list and the "unmapped" note. Pure, server-rendered; d3-geo runs
 * server-side fine, so no client component needed.
 */
export function LeagueMap({ teams }: { teams: TeamLoc[] }) {
  const { statePaths, markers } = buildBasemap(teams, W, H);
  const regions = teamRegions(teams);
  const unmapped = teams.length - markers.length;
  const maxRegion = Math.max(1, ...regions.map((r) => r.count));

  if (teams.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No teams yet — add some to see where your league plays.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      {/* Basemap */}
      <div className="flex-1">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full rounded-lg border border-border bg-muted/30"
          role="img"
          aria-label="Map of team locations across the United States"
        >
          <g
            className="fill-foreground/[0.04] stroke-foreground/20"
            strokeWidth={0.5}
            strokeLinejoin="round"
          >
            {statePaths.map((d, i) => (
              <path key={i} d={d} />
            ))}
          </g>
          {markers.map((p, i) => (
            <g key={`${p.name}-${i}`}>
              <circle cx={p.x} cy={p.y} r={6} className="fill-foreground/10" />
              <circle cx={p.x} cy={p.y} r={2.5} className="fill-foreground">
                <title>
                  {p.name} · {p.city}
                </title>
              </circle>
            </g>
          ))}
        </svg>
        <p className="mt-2 text-xs text-muted-foreground">
          {markers.length} of {teams.length} team
          {teams.length === 1 ? "" : "s"} mapped
          {unmapped > 0 ? ` · ${unmapped} without a known city` : ""}.
        </p>
      </div>

      {/* Regions list */}
      <div className="lg:w-56">
        <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Regions
        </h4>
        <ul className="space-y-2">
          {regions.slice(0, 8).map((r) => (
            <li key={r.region} className="text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-medium text-foreground">
                  {r.region}
                </span>
                <span className="font-mono text-muted-foreground">
                  {r.count}
                </span>
              </div>
              <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-foreground/60"
                  style={{ width: `${(r.count / maxRegion) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

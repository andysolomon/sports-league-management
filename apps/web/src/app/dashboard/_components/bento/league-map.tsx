"use client";

import { useMemo, useState } from "react";
import type { FeatureCollection, Geometry } from "geojson";
import { teamRegions, type TeamLoc } from "@/lib/geo";
import {
  STATES,
  statesAsRegions,
  findState,
  countiesForState,
  loadCounties,
  locateTeams,
  teamsInFeature,
  buildLevel,
  type LevelView,
} from "@/lib/geo-drilldown";

const W = 320;
const H = 220;

type Drill =
  | { level: "us" }
  | { level: "state"; stateId: string; stateName: string }
  | {
      level: "county";
      stateId: string;
      stateName: string;
      countyId: string;
      countyName: string;
    };

type Counties = FeatureCollection<Geometry, { name?: string }>;

/**
 * League geography (WSM-000148): an interactive drill-down map. Click a state to
 * break it into counties, click a county to see its team-cities. The US state
 * geometry is bundled (default view); county geometry is lazy-fetched from
 * /public on the first drill, so it never bloats the initial bundle. Team→region
 * placement is point-in-polygon (geoContains) on each team's city coordinate.
 * Beside it, the Vercel-style regions list (unchanged).
 */
export function LeagueMap({ teams }: { teams: TeamLoc[] }) {
  const [drill, setDrill] = useState<Drill>({ level: "us" });
  const [counties, setCounties] = useState<Counties | null>(null);
  const [loadingCounties, setLoadingCounties] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const located = useMemo(() => locateTeams(teams), [teams]);
  const regions = useMemo(() => teamRegions(teams), [teams]);
  const maxRegion = Math.max(1, ...regions.map((r) => r.count));
  const unmapped = teams.length - located.length;

  // Lazy-load county geometry on the first drill into a state. Triggered from
  // the click handler (not an effect) so the fetch + setState live in an event
  // callback — the idiomatic place for it.
  async function ensureCounties() {
    if (counties || loadingCounties) return;
    setLoadingCounties(true);
    setLoadError(false);
    try {
      setCounties(await loadCounties());
    } catch {
      setLoadError(true);
    } finally {
      setLoadingCounties(false);
    }
  }

  // Compute the current level's outline paths + markers.
  const view: LevelView | null = useMemo(() => {
    if (drill.level === "us") {
      return buildLevel(statesAsRegions(), STATES, located, W, H, true);
    }
    if (!counties) return null;
    const state = findState(drill.stateId);
    if (!state) return null;

    if (drill.level === "state") {
      const inState = teamsInFeature(located, state.feature);
      return buildLevel(
        countiesForState(counties, drill.stateId),
        state.feature,
        inState,
        W,
        H,
        false,
      );
    }

    // county level
    const county = countiesForState(counties, drill.stateId).find(
      (c) => c.id === drill.countyId,
    );
    if (!county) return null;
    const inCounty = teamsInFeature(located, county.feature);
    return buildLevel([county], county.feature, inCounty, W, H, false);
  }, [drill, counties, located]);

  const maxCount = Math.max(1, ...(view?.paths.map((p) => p.count) ?? [1]));

  function regionFill(count: number): number {
    return count === 0 ? 0.04 : 0.15 + 0.5 * (count / maxCount);
  }

  function onRegionClick(id: string, name: string) {
    if (drill.level === "us") {
      setDrill({ level: "state", stateId: id, stateName: name });
      void ensureCounties();
    } else if (drill.level === "state") {
      setDrill({
        level: "county",
        stateId: drill.stateId,
        stateName: drill.stateName,
        countyId: id,
        countyName: name,
      });
    }
    // county level: leaf — clicking a county does nothing further.
  }

  const isLeaf = drill.level === "county";
  const showCityLabels = drill.level === "county";

  if (teams.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No teams yet — add some to see where your league plays.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <div className="flex-1">
        {/* Breadcrumb */}
        <nav
          aria-label="Map drill-down"
          className="mb-2 flex flex-wrap items-center gap-1 text-xs text-muted-foreground"
        >
          <Crumb
            label="United States"
            active={drill.level === "us"}
            onClick={() => setDrill({ level: "us" })}
          />
          {drill.level !== "us" && (
            <>
              <span aria-hidden>›</span>
              <Crumb
                label={drill.stateName}
                active={drill.level === "state"}
                onClick={() =>
                  setDrill({
                    level: "state",
                    stateId: drill.stateId,
                    stateName: drill.stateName,
                  })
                }
              />
            </>
          )}
          {drill.level === "county" && (
            <>
              <span aria-hidden>›</span>
              <Crumb label={`${drill.countyName} County`} active onClick={() => {}} />
            </>
          )}
        </nav>

        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full rounded-lg border border-border bg-muted/30"
          role="img"
          aria-label={
            drill.level === "us"
              ? "Map of team locations across the United States. Select a state to drill in."
              : drill.level === "state"
                ? `Counties of ${drill.stateName}. Select a county to drill in.`
                : `${drill.countyName} County — team cities.`
          }
        >
          <g strokeLinejoin="round">
            {view?.paths.map((p) => {
              const clickable = !isLeaf;
              return (
                <path
                  key={p.id}
                  d={p.d}
                  className={`stroke-foreground/25 ${
                    clickable ? "cursor-pointer focus:outline-none" : ""
                  }`}
                  fill="currentColor"
                  fillOpacity={regionFill(p.count)}
                  strokeWidth={drill.level === "us" ? 0.5 : 0.4}
                  role={clickable ? "button" : undefined}
                  tabIndex={clickable ? 0 : undefined}
                  aria-label={
                    clickable
                      ? `${p.name} — ${p.count} team${p.count === 1 ? "" : "s"}, drill in`
                      : undefined
                  }
                  onClick={
                    clickable ? () => onRegionClick(p.id, p.name) : undefined
                  }
                  onKeyDown={
                    clickable
                      ? (e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onRegionClick(p.id, p.name);
                          }
                        }
                      : undefined
                  }
                />
              );
            })}
          </g>

          {view?.markers.map((m, i) => (
            <g key={`${m.name}-${i}`}>
              <circle cx={m.x} cy={m.y} r={5} className="fill-primary/20" />
              <circle cx={m.x} cy={m.y} r={2.5} className="fill-primary">
                <title>
                  {m.name} · {m.city}
                </title>
              </circle>
              {showCityLabels && (
                <text
                  x={m.x}
                  y={m.y - 6}
                  textAnchor="middle"
                  className="fill-foreground text-[7px] font-medium"
                >
                  {m.city}
                </text>
              )}
            </g>
          ))}
        </svg>

        <p className="mt-2 text-xs text-muted-foreground" aria-live="polite">
          {loadingCounties
            ? "Loading counties…"
            : loadError
              ? "Couldn’t load county map — try again."
              : drill.level === "us"
                ? `${located.length} of ${teams.length} team${teams.length === 1 ? "" : "s"} mapped${unmapped > 0 ? ` · ${unmapped} without a known city` : ""}. Select a state to drill in.`
                : drill.level === "state"
                  ? `${drill.stateName} · select a county.`
                  : `${drill.countyName} County · ${view?.markers.length ?? 0} team-cit${(view?.markers.length ?? 0) === 1 ? "y" : "ies"}.`}
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
                <span className="font-mono text-muted-foreground">{r.count}</span>
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

function Crumb({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  if (active) {
    return <span className="font-medium text-foreground">{label}</span>;
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-primary hover:underline"
    >
      {label}
    </button>
  );
}

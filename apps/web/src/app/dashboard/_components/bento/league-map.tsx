"use client";

import { useEffect, useMemo, useState } from "react";
import type { FeatureCollection, Geometry } from "geojson";
import { teamRegions, lookupCoords, type TeamLoc } from "@/lib/geo";
import {
  loadCities,
  cityCoords,
  type CitiesByState,
} from "@/lib/us-cities";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const W = 320;
const H = 220;

const ALL = "all"; // sentinel: "United States" / "All counties" (Radix forbids "")

type Counties = FeatureCollection<Geometry, { name?: string }>;

/**
 * League geography (WSM-000148): a drill-down map driven by two PICK LISTS, not
 * by clicking the map. Choose a state → the map zooms to its counties; choose a
 * county → it zooms to that county's team-cities. The map is a reactive,
 * read-only visualization. The lists only offer states/counties that actually
 * contain teams (so it's short and relevant). State geometry is bundled; county
 * geometry lazy-loads from /public on the first state pick, so it never bloats
 * the initial bundle. Placement is point-in-polygon on each team's coordinate.
 */
export function LeagueMap({ teams }: { teams: TeamLoc[] }) {
  const [stateValue, setStateValue] = useState<string>(ALL);
  const [countyValue, setCountyValue] = useState<string>(ALL);
  const [counties, setCounties] = useState<Counties | null>(null);
  const [loadingCounties, setLoadingCounties] = useState(false);
  const [loadError, setLoadError] = useState(false);

  // Full cities dataset for placing teams whose city isn't in the bundled metro
  // set. Only fetched when actually needed (some team can't be placed by the
  // bundled lookup) — for an all-metro league it never loads.
  const [cities, setCities] = useState<CitiesByState | null>(null);
  const needCities = useMemo(
    () => teams.some((t) => t.city && !lookupCoords(t.city)),
    [teams],
  );
  useEffect(() => {
    if (!needCities || cities) return;
    let cancelled = false;
    async function load() {
      try {
        const data = await loadCities();
        if (!cancelled) setCities(data);
      } catch {
        // Non-fatal: bundled metro lookup still places known cities.
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [needCities, cities]);

  const located = useMemo(
    () =>
      locateTeams(teams, (city, state) =>
        cities && state ? cityCoords(cities, state, city) : null,
      ),
    [teams, cities],
  );
  const regions = useMemo(() => teamRegions(teams), [teams]);
  const maxRegion = Math.max(1, ...regions.map((r) => r.count));
  const unmapped = teams.length - located.length;

  // Only states that actually contain teams (keeps the pick list short).
  const statesWithTeams = useMemo(
    () =>
      statesAsRegions()
        .map((s) => ({
          id: s.id,
          name: s.name,
          count: teamsInFeature(located, s.feature).length,
        }))
        .filter((s) => s.count > 0)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [located],
  );

  // Counties of the selected state that contain teams (needs counties loaded).
  const countyOptions = useMemo(() => {
    if (stateValue === ALL || !counties) return [];
    return countiesForState(counties, stateValue)
      .map((c) => ({
        id: c.id,
        name: c.name,
        count: teamsInFeature(located, c.feature).length,
      }))
      .filter((c) => c.count > 0)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [stateValue, counties, located]);

  const stateName = useMemo(
    () => (stateValue === ALL ? null : (findState(stateValue)?.name ?? null)),
    [stateValue],
  );
  const countyName =
    countyValue === ALL
      ? null
      : (countyOptions.find((c) => c.id === countyValue)?.name ?? null);

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

  function onStateChange(value: string) {
    setStateValue(value);
    setCountyValue(ALL);
    if (value !== ALL) void ensureCounties();
  }

  // The map reacts to the pick-list selections.
  const view: LevelView | null = useMemo(() => {
    if (stateValue === ALL) {
      return buildLevel(statesAsRegions(), STATES, located, W, H, true);
    }
    if (!counties) return null;
    const state = findState(stateValue);
    if (!state) return null;

    if (countyValue === ALL) {
      const inState = teamsInFeature(located, state.feature);
      return buildLevel(
        countiesForState(counties, stateValue),
        state.feature,
        inState,
        W,
        H,
        false,
      );
    }
    const county = countiesForState(counties, stateValue).find(
      (c) => c.id === countyValue,
    );
    if (!county) return null;
    const inCounty = teamsInFeature(located, county.feature);
    return buildLevel([county], county.feature, inCounty, W, H, false);
  }, [stateValue, countyValue, counties, located]);

  const level =
    stateValue === ALL ? "us" : countyValue === ALL ? "state" : "county";
  const maxCount = Math.max(1, ...(view?.paths.map((p) => p.count) ?? [1]));
  const regionFill = (count: number) =>
    count === 0 ? 0.04 : 0.15 + 0.5 * (count / maxCount);

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
        {/* Pick-list controls — these drive the map. */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Select value={stateValue} onValueChange={onStateChange}>
            <SelectTrigger className="w-[180px]" aria-label="State">
              <SelectValue placeholder="United States" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>United States (all)</SelectItem>
              {statesWithTeams.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name} ({s.count})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={countyValue}
            onValueChange={setCountyValue}
            disabled={stateValue === ALL || loadingCounties}
          >
            <SelectTrigger className="w-[180px]" aria-label="County">
              <SelectValue
                placeholder={loadingCounties ? "Loading counties…" : "All counties"}
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>
                {stateName ? `All of ${stateName}` : "All counties"}
              </SelectItem>
              {countyOptions.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name} County ({c.count})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full rounded-lg border border-border bg-muted/30"
          role="img"
          aria-label={
            level === "us"
              ? "Map of team locations across the United States."
              : level === "state"
                ? `Counties of ${stateName}, shaded by team count.`
                : `${countyName} County — team cities.`
          }
        >
          <g strokeLinejoin="round">
            {view?.paths.map((p) => (
              <path
                key={p.id}
                d={p.d}
                className="stroke-foreground/25"
                fill="currentColor"
                fillOpacity={regionFill(p.count)}
                strokeWidth={level === "us" ? 0.5 : 0.4}
              />
            ))}
          </g>

          {view?.markers.map((m, i) => (
            <g key={`${m.name}-${i}`}>
              <circle cx={m.x} cy={m.y} r={5} className="fill-primary/20" />
              <circle cx={m.x} cy={m.y} r={2.5} className="fill-primary">
                <title>
                  {m.name} · {m.city}
                </title>
              </circle>
              {level === "county" && (
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
          {loadError
            ? "Couldn’t load county map — try again."
            : level === "us"
              ? `${located.length} of ${teams.length} team${teams.length === 1 ? "" : "s"} mapped${unmapped > 0 ? ` · ${unmapped} without a known city` : ""}. Pick a state to zoom in.`
              : level === "state"
                ? `${stateName} · pick a county to zoom in.`
                : `${countyName} County · ${view?.markers.length ?? 0} team-cit${(view?.markers.length ?? 0) === 1 ? "y" : "ies"}.`}
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

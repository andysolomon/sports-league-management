import { flag } from "flags/next";
import { notFound } from "next/navigation";
import { trackFlagExposure } from "./analytics";

const defaultOn = process.env.VERCEL_ENV !== "production";

// Per-flag production override (WSM-000079/80 cutover): set the env var to
// "on" in Vercel Production and redeploy to flip a flag; "off" forces it
// dark; unset falls back to the VERCEL_ENV default. Read at decide() time so
// each request reflects the deployed env rather than module-load state.
function resolveFlag(envKey: string): boolean {
  const override = process.env[envKey];
  if (override === "on") return true;
  if (override === "off") return false;
  return defaultOn;
}

export const depthChartV1 = flag<boolean>({
  key: "depth_chart_v1",
  description:
    "Phase 0 roster management: depth-chart drag-reorder + per-season edit lock",
  defaultValue: defaultOn,
  options: [
    { label: "Off", value: false },
    { label: "On", value: true },
  ],
  decide: () => {
    const enabled = resolveFlag("FLAG_DEPTH_CHART_V1");
    void trackFlagExposure("depth_chart_v1", enabled);
    return enabled;
  },
});

export const rosterSnapshotsV1 = flag<boolean>({
  key: "roster_snapshots_v1",
  description:
    "Phase 1 roster management: season rosters, assignment audit log, depth chart v2",
  defaultValue: defaultOn,
  options: [
    { label: "Off", value: false },
    { label: "On", value: true },
  ],
  decide: () => {
    const enabled = resolveFlag("FLAG_ROSTER_SNAPSHOTS_V1");
    void trackFlagExposure("roster_snapshots_v1", enabled);
    return enabled;
  },
});

export const playerAttributesV1 = flag<boolean>({
  key: "player_attributes_v1",
  description:
    "Phase 2 player attributes & development: per-season attribute snapshots, dev chart, public viewer",
  defaultValue: defaultOn,
  options: [
    { label: "Off", value: false },
    { label: "On", value: true },
  ],
  decide: () => {
    const enabled = resolveFlag("FLAG_PLAYER_ATTRIBUTES_V1");
    void trackFlagExposure("player_attributes_v1", enabled);
    return enabled;
  },
});

export const schedulesStandingsV1 = flag<boolean>({
  key: "schedules_standings_v1",
  description:
    "Phase 3 schedules & standings: fixtures, game results, computed standings, public standings viewer",
  defaultValue: defaultOn,
  options: [
    { label: "Off", value: false },
    { label: "On", value: true },
  ],
  decide: () => {
    const enabled = resolveFlag("FLAG_SCHEDULES_STANDINGS_V1");
    void trackFlagExposure("schedules_standings_v1", enabled);
    return enabled;
  },
});

export type FeatureFlag = () => Promise<boolean>;

export async function pageGuard(flagFn: FeatureFlag): Promise<void> {
  const enabled = await flagFn();
  if (!enabled) {
    notFound();
  }
}

export async function apiGuard(flagFn: FeatureFlag): Promise<Response | null> {
  const enabled = await flagFn();
  if (!enabled) {
    return Response.json({ error: "flag_disabled" }, { status: 403 });
  }
  return null;
}

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

/*
 * `live_streaming_v1` is a TRUE DARK FLAG (WSM-000144 / streaming epic #225).
 *
 * Unlike the flags above, it must default OFF in EVERY environment — including
 * preview/dev — because flipping it on provisions real Mux live streams that
 * cost money. It therefore does NOT use `resolveFlag` (which defaults ON when
 * `VERCEL_ENV !== "production"`). The only way it turns on is an explicit
 * `FLAG_LIVE_STREAMING_V1=on` per pilot env. Demand validation gates enabling
 * it; the code can ship dark with zero exposure and zero cost until then.
 */
export const liveStreamingV1 = flag<boolean>({
  key: "live_streaming_v1",
  description:
    "DARK — Phase 1 video-only live game streaming (Mux). OFF in every env unless FLAG_LIVE_STREAMING_V1=on.",
  defaultValue: false,
  options: [
    { label: "Off", value: false },
    { label: "On", value: true },
  ],
  decide: () => {
    const enabled = process.env.FLAG_LIVE_STREAMING_V1 === "on";
    void trackFlagExposure("live_streaming_v1", enabled);
    return enabled;
  },
});

export const statKeepingV1 = flag<boolean>({
  key: "stat_keeping_v1",
  description:
    "Stat-keeping keystone: per-game box-score entry, season totals, MaxPreps export (WSM-000112)",
  defaultValue: defaultOn,
  options: [
    { label: "Off", value: false },
    { label: "On", value: true },
  ],
  decide: () => {
    const enabled = resolveFlag("FLAG_STAT_KEEPING_V1");
    void trackFlagExposure("stat_keeping_v1", enabled);
    return enabled;
  },
});

export const liveScoringV1 = flag<boolean>({
  key: "live_scoring_v1",
  description:
    "Keystone v3 live scoring: operator-driven running scoreboard + public live game-state (WSM-000152)",
  defaultValue: defaultOn,
  options: [
    { label: "Off", value: false },
    { label: "On", value: true },
  ],
  decide: () => {
    const enabled = resolveFlag("FLAG_LIVE_SCORING_V1");
    void trackFlagExposure("live_scoring_v1", enabled);
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

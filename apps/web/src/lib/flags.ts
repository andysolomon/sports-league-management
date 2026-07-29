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

/*
 * Low-latency (LL-HLS) sub-flag of `live_streaming_v1` (WSM-000200, #303
 * track 2). Same dark idiom: default OFF in EVERY environment — low latency
 * changes the cost/quality tradeoff of real paid Mux streams, so a pilot env
 * opts in explicitly with `FLAG_LOW_LATENCY_STREAMING_V1=on`. Off (or unset)
 * keeps standard HLS exactly as before. Only consulted at stream START, and
 * only on the Mux path — it does nothing while `live_streaming_v1` is dark.
 */
export const lowLatencyStreamingV1 = flag<boolean>({
  key: "low_latency_streaming_v1",
  description:
    "DARK — Mux low-latency (LL-HLS) stream creation (#303 track 2). OFF in every env unless FLAG_LOW_LATENCY_STREAMING_V1=on.",
  defaultValue: false,
  options: [
    { label: "Off", value: false },
    { label: "On", value: true },
  ],
  decide: () => {
    const enabled = process.env.FLAG_LOW_LATENCY_STREAMING_V1 === "on";
    void trackFlagExposure("low_latency_streaming_v1", enabled);
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

export const syntheticRostersV1 = flag<boolean>({
  key: "synthetic_rosters_v1",
  description:
    "Generate synthetic (fake) players to populate demo/test rosters — per team or league-wide (WSM-000173). Enabled in prod for demo leagues.",
  defaultValue: defaultOn,
  options: [
    { label: "Off", value: false },
    { label: "On", value: true },
  ],
  decide: () => {
    const enabled = resolveFlag("FLAG_SYNTHETIC_ROSTERS_V1");
    void trackFlagExposure("synthetic_rosters_v1", enabled);
    return enabled;
  },
});

export const playoffsV1 = flag<boolean>({
  key: "playoffs_v1",
  description:
    "Single-elimination playoffs: seeded bracket generation + auto-advancement (WSM-000164)",
  defaultValue: defaultOn,
  options: [
    { label: "Off", value: false },
    { label: "On", value: true },
  ],
  decide: () => {
    const enabled = resolveFlag("FLAG_PLAYOFFS_V1");
    void trackFlagExposure("playoffs_v1", enabled);
    return enabled;
  },
});

/*
 * Dynasty Mode Epic A — the sim-engine v2 mechanics (A1, A2, A3, A5).
 *
 * The OUTER gate. With this off, no league gets v2 mechanics regardless of its
 * `dynastyConfig`; with it on, each league's own settings decide. That ordering
 * makes this a real kill switch — one env var backs the whole epic out for
 * everyone without touching a single league's preferences, and turning it back
 * on restores exactly what each had chosen.
 *
 * Already-simulated games are unaffected in either direction: `gamePlayLogs`
 * rows are immutable and a final fixture cannot be re-simulated.
 */
export const dynastySimV2 = flag<boolean>({
  key: "dynasty_sim_v2",
  description:
    "Dynasty Mode Epic A: scoring depth, penalties, situational AI and weather in the play-by-play engine",
  defaultValue: defaultOn,
  options: [
    { label: "Off", value: false },
    { label: "On", value: true },
  ],
  decide: () => {
    const enabled = resolveFlag("FLAG_DYNASTY_SIM_V2");
    void trackFlagExposure("dynasty_sim_v2", enabled);
    return enabled;
  },
});

export const dynastyOffseasonV2 = flag<boolean>({
  key: "dynasty_offseason_v2",
  description:
    "Dynasty Mode Epic B: persisted offseason phase machine and the Season offseason route (#618)",
  defaultValue: defaultOn,
  options: [
    { label: "Off", value: false },
    { label: "On", value: true },
  ],
  decide: () => {
    const enabled = resolveFlag("FLAG_DYNASTY_OFFSEASON_V2");
    void trackFlagExposure("dynasty_offseason_v2", enabled);
    return enabled;
  },
});

/*
 * Dynasty Mode Epic C — program management (coaches, prestige, goals).
 *
 * Scheme selection on Team Home stays under `dynastySimV2` (Epic A6) so leagues
 * that shipped with schemes are not hidden when this flag is off.
 */
export const dynastyProgramV1 = flag<boolean>({
  key: "dynasty_program_v1",
  description:
    "Dynasty Mode Epic C: coach identity, staff, Coach Home and program cards (#625)",
  defaultValue: defaultOn,
  options: [
    { label: "Off", value: false },
    { label: "On", value: true },
  ],
  decide: () => {
    const enabled = resolveFlag("FLAG_DYNASTY_PROGRAM_V1");
    void trackFlagExposure("dynasty_program_v1", enabled);
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

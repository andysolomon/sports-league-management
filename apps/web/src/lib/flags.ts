import { flag } from "flags/next";
import { notFound } from "next/navigation";
import { trackFlagExposure } from "./analytics";

const defaultOn = process.env.NODE_ENV !== "production";

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
    void trackFlagExposure("depth_chart_v1", defaultOn);
    return defaultOn;
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
    void trackFlagExposure("roster_snapshots_v1", defaultOn);
    return defaultOn;
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
    void trackFlagExposure("player_attributes_v1", defaultOn);
    return defaultOn;
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

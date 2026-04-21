import { track } from "@vercel/analytics/server";

type Props = Record<string, string | number | boolean | null>;

async function safeTrack(event: string, props: Props): Promise<void> {
  try {
    await track(event, props);
  } catch {
    // Analytics must never block user-facing flows.
  }
}

export function trackFlagExposure(
  flagKey: string,
  value: boolean | string,
): Promise<void> {
  return safeTrack("flag_exposure", {
    flag: flagKey,
    value: String(value),
  });
}

export function trackDepthChartReorder(props: {
  teamId: string;
  seasonId: string;
  positionSlot: string;
  playerCount: number;
}): Promise<void> {
  return safeTrack("depth_chart_reorder", {
    teamId: props.teamId,
    seasonId: props.seasonId,
    positionSlot: props.positionSlot,
    playerCount: props.playerCount,
  });
}

export function trackSeasonLockToggle(props: {
  seasonId: string;
  locked: boolean;
}): Promise<void> {
  return safeTrack("season_lock_toggle", {
    seasonId: props.seasonId,
    locked: props.locked,
  });
}

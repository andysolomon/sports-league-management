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

export function trackRosterAssign(props: {
  seasonId: string;
  teamId: string;
  positionSlot: string;
}): Promise<void> {
  return safeTrack("roster_assign", {
    seasonId: props.seasonId,
    teamId: props.teamId,
    positionSlot: props.positionSlot,
  });
}

export function trackRosterRemove(props: {
  seasonId: string;
  teamId: string;
  positionSlot: string;
}): Promise<void> {
  return safeTrack("roster_remove", {
    seasonId: props.seasonId,
    teamId: props.teamId,
    positionSlot: props.positionSlot,
  });
}

export function trackRosterStatusChange(props: {
  seasonId: string;
  teamId: string;
  fromStatus: string;
  toStatus: string;
}): Promise<void> {
  return safeTrack("roster_status_change", {
    seasonId: props.seasonId,
    teamId: props.teamId,
    fromStatus: props.fromStatus,
    toStatus: props.toStatus,
  });
}

export function trackRosterLimitBlocked(props: {
  seasonId: string;
  teamId: string;
}): Promise<void> {
  return safeTrack("roster_limit_blocked", {
    seasonId: props.seasonId,
    teamId: props.teamId,
  });
}

// --- Phase 2 (player_attributes_v1) ------------------------------

export function trackPlayerAttributesView(props: {
  playerId: string;
  /** "dashboard" or "public" — distinguishes the two viewer routes. */
  route: "dashboard" | "public";
}): Promise<void> {
  return safeTrack("player_attributes_view", {
    playerId: props.playerId,
    route: props.route,
  });
}

export function trackPlayerAttributesIngest(props: {
  playerId: string;
  seasonId: string;
  source: "pff" | "madden" | "admin";
}): Promise<void> {
  return safeTrack("player_attributes_ingest", {
    playerId: props.playerId,
    seasonId: props.seasonId,
    source: props.source,
  });
}

// --- Phase 3 (schedules_standings_v1) ----------------------------

export function trackFixtureCreated(props: {
  leagueId: string;
  seasonId: string;
}): Promise<void> {
  return safeTrack("fixture_created", {
    leagueId: props.leagueId,
    seasonId: props.seasonId,
  });
}

export function trackResultRecorded(props: {
  leagueId: string;
  fixtureId: string;
  homeScore: number;
  awayScore: number;
}): Promise<void> {
  return safeTrack("result_recorded", {
    leagueId: props.leagueId,
    fixtureId: props.fixtureId,
    homeScore: props.homeScore,
    awayScore: props.awayScore,
  });
}

export function trackStandingsView(props: {
  leagueId: string;
  /** "dashboard" or "public" — distinguishes the two viewer routes. */
  route: "dashboard" | "public";
}): Promise<void> {
  return safeTrack("standings_view", {
    leagueId: props.leagueId,
    route: props.route,
  });
}

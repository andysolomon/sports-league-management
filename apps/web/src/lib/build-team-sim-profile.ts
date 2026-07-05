import type { PlayerDto } from "@sports-management/shared-types";
import {
  getDepthChartByTeamSeason,
  getPlayersByTeam,
  getRosterBySeasonTeam,
  getTeamAttributeSnapshots,
  getTeamMaddenOveralls,
} from "@/lib/data-api";
import type { OrgContext } from "@/lib/org-context";
import type { PlayerSimProfile, TeamSimProfile } from "@/lib/pbp";

const NEUTRAL_OVERALL = 50;

function mean(values: number[]): number {
  if (values.length === 0) return NEUTRAL_OVERALL;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function teamStrengthFromMaps(
  snaps: Map<string, { weightedOverall: number | null }>,
  madden: Map<string, number>,
): number {
  const sprt = [...snaps.values()]
    .map((s) => s.weightedOverall)
    .filter((n): n is number => n != null);
  if (sprt.length > 0) return mean(sprt);
  if (madden.size > 0) return mean([...madden.values()]);
  return NEUTRAL_OVERALL;
}

function resolvePlayerOverall(
  playerId: string,
  snaps: Map<string, { weightedOverall: number | null }>,
  madden: Map<string, number>,
): number {
  const snap = snaps.get(playerId);
  if (snap?.weightedOverall != null) return snap.weightedOverall;
  const mad = madden.get(playerId);
  if (mad != null) return mad;
  return NEUTRAL_OVERALL;
}

export type TeamSimProfileCache = Map<string, TeamSimProfile>;

export function teamSimProfileCacheKey(teamId: string, seasonId: string): string {
  return `${teamId}:${seasonId}`;
}

/**
 * Build a `TeamSimProfile` for the PBP engine from roster + ratings + depth.
 * Cached per (teamId, seasonId) for batch season sims.
 */
export async function buildTeamSimProfile(
  teamId: string,
  seasonId: string,
  orgContext: OrgContext,
  cache: TeamSimProfileCache,
): Promise<TeamSimProfile> {
  const key = teamSimProfileCacheKey(teamId, seasonId);
  const cached = cache.get(key);
  if (cached) return cached;

  const [players, snaps, madden, roster, depthChart] = await Promise.all([
    getPlayersByTeam(teamId, orgContext).catch(() => [] as PlayerDto[]),
    getTeamAttributeSnapshots(teamId, orgContext).catch(
      () => new Map<string, { weightedOverall: number | null; attributes: Record<string, number> }>(),
    ),
    getTeamMaddenOveralls(teamId, orgContext).catch(() => new Map<string, number>()),
    getRosterBySeasonTeam(seasonId, teamId).catch(() => []),
    getDepthChartByTeamSeason(teamId, seasonId).catch(() => []),
  ]);

  const depthByPlayer = new Map<string, { positionSlot?: string; depthRank?: number }>();
  for (const row of roster) {
    depthByPlayer.set(row.playerId, {
      positionSlot: row.positionSlot,
      depthRank: row.depthRank,
    });
  }
  for (const row of depthChart) {
    if (!depthByPlayer.has(row.playerId)) {
      depthByPlayer.set(row.playerId, {
        positionSlot: row.positionSlot,
        depthRank: row.sortOrder,
      });
    }
  }

  const simPlayers: PlayerSimProfile[] = players.map((p) => {
    const depth = depthByPlayer.get(p.id);
    return {
      playerId: p.id,
      position: p.position,
      overall: resolvePlayerOverall(p.id, snaps, madden),
      positionSlot: depth?.positionSlot,
      depthRank: depth?.depthRank,
    };
  });

  const profile: TeamSimProfile = {
    teamId,
    strength: teamStrengthFromMaps(snaps, madden),
    players: simPlayers,
  };
  cache.set(key, profile);
  return profile;
}

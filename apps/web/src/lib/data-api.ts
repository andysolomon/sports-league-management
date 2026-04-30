import { makeFunctionReference } from "convex/server";
import type {
  CreatePlayerInput,
  CreateTeamInput,
  DepthChartEntryDto,
  DivisionDto,
  ImportError,
  ImportResult,
  LeagueDto,
  PlayerDto,
  RosterAssignmentDto,
  RosterAuditLogDto,
  SeasonDto,
  SyncConfig,
  SyncReport,
  TeamDto,
  UpdatePlayerInput,
  UpdateTeamInput,
} from "@sports-management/shared-types";
import type { LeagueImportPayload } from "@sports-management/api-contracts";
import { getConvexClient } from "./convex-client";
import type { OrgContext } from "./org-context";

async function getClerkServerClient() {
  const clerkModule = (await import("@clerk/nextjs/server")) as {
    clerkClient?: () => Promise<{
      organizations: {
        createOrganization: (input: {
          name: string;
          createdBy: string;
        }) => Promise<{ id: string }>;
      };
    }>;
    default?: {
      clerkClient?: () => Promise<{
        organizations: {
          createOrganization: (input: {
            name: string;
            createdBy: string;
          }) => Promise<{ id: string }>;
        };
      }>;
    };
  };

  const clientFactory =
    clerkModule.clerkClient ?? clerkModule.default?.clerkClient;

  if (!clientFactory) {
    throw new Error("Failed to load Clerk server client");
  }

  return clientFactory();
}

function queryRef<Args extends object, Return>(name: string) {
  return makeFunctionReference<"query", any, Return>(name);
}

function mutationRef<Args extends object, Return>(name: string) {
  return makeFunctionReference<"mutation", any, Return>(name);
}

const refs = {
  getVisibleLeagueContext: queryRef<
    { orgIds: string[]; userId: string },
    { visibleLeagueIds: string[]; subscribedLeagueIds: string[] }
  >("sports:getVisibleLeagueContext"),
  listPublicLeagues: queryRef<Record<string, never>, LeagueDto[]>(
    "sports:listPublicLeagues",
  ),
  getLeagueByInviteToken: queryRef<
    { token: string },
    { leagueId: string; orgId: string | null; name: string } | null
  >("sports:getLeagueByInviteToken"),
  getLeagueForOrg: queryRef<
    { orgId: string },
    { id: string; token: string | null } | null
  >("sports:getLeagueForOrg"),
  getLeagueOrgId: queryRef<{ leagueId: string }, string | null>(
    "sports:getLeagueOrgId",
  ),
  getLeagueByName: queryRef<{ name: string }, LeagueDto | null>(
    "sports:getLeagueByName",
  ),
  listLeagues: queryRef<{ leagueIds: string[] }, LeagueDto[]>("sports:listLeagues"),
  getLeague: queryRef<{ leagueId: string }, LeagueDto | null>("sports:getLeague"),
  listDivisions: queryRef<{ leagueIds: string[] }, DivisionDto[]>(
    "sports:listDivisions",
  ),
  getDivision: queryRef<{ divisionId: string }, DivisionDto | null>(
    "sports:getDivision",
  ),
  listTeams: queryRef<{ leagueIds: string[] }, TeamDto[]>("sports:listTeams"),
  listTeamsByLeague: queryRef<{ leagueId: string }, TeamDto[]>(
    "sports:listTeamsByLeague",
  ),
  getTeam: queryRef<{ teamId: string }, TeamDto | null>("sports:getTeam"),
  getTeamLeagueId: queryRef<{ teamId: string }, string | null>(
    "sports:getTeamLeagueId",
  ),
  listPlayers: queryRef<{ leagueIds: string[] }, PlayerDto[]>("sports:listPlayers"),
  listPlayersByTeam: queryRef<{ teamId: string }, PlayerDto[]>(
    "sports:listPlayersByTeam",
  ),
  getPlayer: queryRef<{ playerId: string }, PlayerDto | null>("sports:getPlayer"),
  listSeasons: queryRef<{ leagueIds: string[] }, SeasonDto[]>("sports:listSeasons"),
  getSeason: queryRef<{ seasonId: string }, SeasonDto | null>("sports:getSeason"),
  getSyncConfig: queryRef<
    Record<string, never>,
    { syncEnabled: boolean; lastSyncReportJson: string | null }
  >("sports:getSyncConfig"),
  healthSummary: queryRef<
    Record<string, never>,
    {
      leagues: number;
      divisions: number;
      teams: number;
      players: number;
      seasons: number;
    }
  >("sports:healthSummary"),
  upsertLeague: mutationRef<
    { name: string; orgId: string | null },
    { dto: LeagueDto; created: boolean }
  >("sports:upsertLeague"),
  upsertDivision: mutationRef<
    { name: string; leagueId: string },
    { dto: DivisionDto; created: boolean }
  >("sports:upsertDivision"),
  upsertTeam: mutationRef<
    {
      name: string;
      city: string;
      stadium: string;
      leagueId: string;
      divisionId: string | null;
      logoUrl: string | null;
    },
    { dto: TeamDto; created: boolean }
  >("sports:upsertTeam"),
  upsertPlayer: mutationRef<
    {
      name: string;
      leagueId: string;
      teamId: string;
      position: string;
      jerseyNumber: number | null;
      dateOfBirth: string | null;
      status: string;
      headshotUrl: string | null;
    },
    { dto: PlayerDto; created: boolean }
  >("sports:upsertPlayer"),
  upsertSeason: mutationRef<
    {
      name: string;
      leagueId: string;
      startDate: string | null;
      endDate: string | null;
      status: string;
    },
    { dto: SeasonDto; created: boolean }
  >("sports:upsertSeason"),
  setLeagueInviteToken: mutationRef<
    { leagueId: string; token: string | null },
    null
  >("sports:setLeagueInviteToken"),
  subscribeToLeague: mutationRef<{ userId: string; leagueId: string }, null>(
    "sports:subscribeToLeague",
  ),
  unsubscribeFromLeague: mutationRef<{ userId: string; leagueId: string }, null>(
    "sports:unsubscribeFromLeague",
  ),
  createTeam: mutationRef<CreateTeamInput, TeamDto>("sports:createTeam"),
  updateTeam: mutationRef<
    { teamId: string } & UpdateTeamInput,
    TeamDto | null
  >("sports:updateTeam"),
  createPlayer: mutationRef<CreatePlayerInput, PlayerDto>("sports:createPlayer"),
  updatePlayer: mutationRef<
    { playerId: string } & UpdatePlayerInput,
    PlayerDto | null
  >("sports:updatePlayer"),
  deletePlayer: mutationRef<{ playerId: string }, null>("sports:deletePlayer"),
  setSyncEnabled: mutationRef<{ enabled: boolean }, null>("sports:setSyncEnabled"),
  writeSyncReport: mutationRef<{ reportJson: string }, null>(
    "sports:writeSyncReport",
  ),
  ingestPlayerAttributes: mutationRef<
    {
      playerId: string;
      seasonId: string;
      positionGroup: string;
      attributesJson: string;
      pffSourceJson: string | null;
      maddenSourceJson: string | null;
      pffWeight: number;
      maddenWeight: number;
      weightedOverall: number | null;
    },
    { id: string; created: boolean }
  >("sports:ingestPlayerAttributes"),
  getPlayerDevelopment: queryRef<
    { playerId: string },
    Array<{
      id: string;
      seasonId: string;
      seasonName: string;
      seasonStartDate: string | null;
      positionGroup: string;
      attributes: Record<string, number>;
      weightedOverall: number | null;
      delta: number | null;
      ingestedAt: string;
    }>
  >("sports:getPlayerDevelopment"),
  getSeasonAttributesByPosition: queryRef<
    { seasonId: string; positionGroup: string; limit?: number },
    Array<{
      playerId: string;
      playerName: string;
      positionGroup: string;
      attributes: Record<string, number>;
      weightedOverall: number | null;
      ingestedAt: string;
    }>
  >("sports:getSeasonAttributesByPosition"),
  getLeagueVisibility: queryRef<
    { leagueId: string },
    { isPublic: boolean } | null
  >("sports:getLeagueVisibility"),
  setLeaguePublic: mutationRef<
    { leagueId: string; isPublic: boolean },
    null
  >("sports:setLeaguePublic"),
  getPlayerDevelopmentPublic: queryRef<
    { leagueId: string; playerId: string },
    Array<{
      id: string;
      seasonId: string;
      seasonName: string;
      seasonStartDate: string | null;
      positionGroup: string;
      attributes: Record<string, number>;
      weightedOverall: number | null;
      delta: number | null;
      ingestedAt: string;
    }> | null
  >("sports:getPlayerDevelopmentPublic"),
  getDepthChartByTeamSeason: queryRef<
    { teamId: string; seasonId: string },
    DepthChartEntryDto[]
  >("sports:getDepthChartByTeamSeason"),
  reorderDepthChart: mutationRef<
    {
      teamId: string;
      seasonId: string;
      positionSlot: string;
      playerIds: string[];
    },
    DepthChartEntryDto[]
  >("sports:reorderDepthChart"),
  setRosterLocked: mutationRef<
    { seasonId: string; locked: boolean },
    { seasonId: string; rosterLocked: boolean }
  >("sports:setRosterLocked"),
  getRosterBySeasonTeam: queryRef<
    { seasonId: string; teamId: string },
    RosterAssignmentDto[]
  >("sports:getRosterBySeasonTeam"),
  getTeamRosterLimitStatus: queryRef<
    { seasonId: string; teamId: string },
    {
      activeCount: number;
      rosterLimit: number | null;
      remaining: number | null;
    }
  >("sports:getTeamRosterLimitStatus"),
  getRosterAssignmentHistory: queryRef<
    {
      teamId: string;
      seasonId: string;
      playerId: string | null;
      limit: number | null;
    },
    RosterAuditLogDto[]
  >("sports:getRosterAssignmentHistory"),
  assignPlayerToRoster: mutationRef<
    {
      seasonId: string;
      teamId: string;
      playerId: string;
      positionSlot: string;
      actorUserId: string;
    },
    RosterAssignmentDto
  >("sports:assignPlayerToRoster"),
  removePlayerFromRoster: mutationRef<
    { assignmentId: string; actorUserId: string },
    null
  >("sports:removePlayerFromRoster"),
  updateRosterStatus: mutationRef<
    {
      assignmentId: string;
      newStatus: string;
      actorUserId: string;
    },
    RosterAssignmentDto
  >("sports:updateRosterStatus"),
};

function requireLeagueAccessLocal(leagueId: string, orgContext: OrgContext): void {
  if (!orgContext.visibleLeagueIds.includes(leagueId)) {
    throw new Error("You do not have access to this league");
  }
}

async function queryConvex<Args extends object, Return>(
  ref: ReturnType<typeof queryRef<Args, Return>>,
  args: Args,
): Promise<Return> {
  const client = getConvexClient();
  return (client as unknown as {
    query: (reference: unknown, payload: unknown) => Promise<Return>;
  }).query(ref, args);
}

async function mutateConvex<Args extends object, Return>(
  ref: ReturnType<typeof mutationRef<Args, Return>>,
  args: Args,
): Promise<Return> {
  const client = getConvexClient();
  return (client as unknown as {
    mutation: (reference: unknown, payload: unknown) => Promise<Return>;
  }).mutation(ref, args);
}

export async function getVisibleLeagueContext(userId: string, orgIds: string[]) {
  return queryConvex(refs.getVisibleLeagueContext, { userId, orgIds });
}

export async function getPublicLeagues(): Promise<LeagueDto[]> {
  return queryConvex(refs.listPublicLeagues, {});
}

export async function getLeagueByInviteToken(
  token: string,
): Promise<{ leagueId: string; orgId: string | null; name: string } | null> {
  return queryConvex(refs.getLeagueByInviteToken, { token });
}

export async function getLeagueForOrg(
  orgId: string,
): Promise<{ id: string; token: string | null } | null> {
  return queryConvex(refs.getLeagueForOrg, { orgId });
}

export async function setLeagueInviteToken(
  leagueId: string,
  token: string | null,
): Promise<void> {
  await mutateConvex(refs.setLeagueInviteToken, { leagueId, token });
}

export async function getLeagueOrgId(leagueId: string): Promise<string | null> {
  return queryConvex(refs.getLeagueOrgId, { leagueId });
}

export async function getLeagues(visibleLeagueIds: string[]): Promise<LeagueDto[]> {
  if (visibleLeagueIds.length === 0) return [];
  return queryConvex(refs.listLeagues, { leagueIds: visibleLeagueIds });
}

export async function getLeague(
  id: string,
  orgContext: OrgContext,
): Promise<LeagueDto> {
  requireLeagueAccessLocal(id, orgContext);
  const league = await queryConvex(refs.getLeague, { leagueId: id });
  if (!league) throw new Error("League not found");
  return league;
}

export async function getLeagueByName(name: string): Promise<LeagueDto | null> {
  return queryConvex(refs.getLeagueByName, { name });
}

export async function getDivisions(
  visibleLeagueIds: string[],
): Promise<DivisionDto[]> {
  if (visibleLeagueIds.length === 0) return [];
  return queryConvex(refs.listDivisions, { leagueIds: visibleLeagueIds });
}

export async function getDivision(
  id: string,
  orgContext: OrgContext,
): Promise<DivisionDto> {
  const division = await queryConvex(refs.getDivision, { divisionId: id });
  if (!division) throw new Error("Division not found");
  requireLeagueAccessLocal(division.leagueId, orgContext);
  return division;
}

export async function getTeams(visibleLeagueIds: string[]): Promise<TeamDto[]> {
  if (visibleLeagueIds.length === 0) return [];
  return queryConvex(refs.listTeams, { leagueIds: visibleLeagueIds });
}

export async function getTeamsByLeague(
  leagueId: string,
  orgContext: OrgContext,
): Promise<TeamDto[]> {
  requireLeagueAccessLocal(leagueId, orgContext);
  return queryConvex(refs.listTeamsByLeague, { leagueId });
}

export async function getTeam(
  id: string,
  orgContext: OrgContext,
): Promise<TeamDto> {
  const team = await queryConvex(refs.getTeam, { teamId: id });
  if (!team) throw new Error("Team not found");
  requireLeagueAccessLocal(team.leagueId, orgContext);
  return team;
}

export async function getTeamLeagueId(teamId: string): Promise<string> {
  const leagueId = await queryConvex(refs.getTeamLeagueId, { teamId });
  if (!leagueId) throw new Error("Team not found");
  return leagueId;
}

export async function getPlayers(
  visibleLeagueIds: string[],
): Promise<PlayerDto[]> {
  if (visibleLeagueIds.length === 0) return [];
  return queryConvex(refs.listPlayers, { leagueIds: visibleLeagueIds });
}

export async function getPlayer(
  id: string,
  orgContext: OrgContext,
): Promise<PlayerDto> {
  const player = await queryConvex(refs.getPlayer, { playerId: id });
  if (!player) throw new Error("Player not found");

  const teamLeagueId = await getTeamLeagueId(player.teamId);
  requireLeagueAccessLocal(teamLeagueId, orgContext);
  return player;
}

export async function getPlayersByTeam(
  teamId: string,
  orgContext: OrgContext,
): Promise<PlayerDto[]> {
  const teamLeagueId = await getTeamLeagueId(teamId);
  requireLeagueAccessLocal(teamLeagueId, orgContext);
  return queryConvex(refs.listPlayersByTeam, { teamId });
}

export async function getSeasons(
  visibleLeagueIds: string[],
): Promise<SeasonDto[]> {
  if (visibleLeagueIds.length === 0) return [];
  return queryConvex(refs.listSeasons, { leagueIds: visibleLeagueIds });
}

export async function getSeason(
  id: string,
  orgContext: OrgContext,
): Promise<SeasonDto> {
  const season = await queryConvex(refs.getSeason, { seasonId: id });
  if (!season) throw new Error("Season not found");
  requireLeagueAccessLocal(season.leagueId, orgContext);
  return season;
}

export async function createPlayer(input: CreatePlayerInput): Promise<PlayerDto> {
  return mutateConvex(refs.createPlayer, input);
}

export async function updatePlayer(
  id: string,
  input: UpdatePlayerInput,
): Promise<PlayerDto> {
  const player = await mutateConvex(refs.updatePlayer, {
    playerId: id,
    ...input,
  });
  if (!player) throw new Error("Player not found");
  return player;
}

export async function deletePlayer(id: string): Promise<null> {
  return mutateConvex(refs.deletePlayer, { playerId: id });
}

export async function createTeam(input: CreateTeamInput): Promise<TeamDto> {
  return mutateConvex(refs.createTeam, input);
}

export async function updateTeam(
  id: string,
  input: UpdateTeamInput,
): Promise<TeamDto> {
  const team = await mutateConvex(refs.updateTeam, {
    teamId: id,
    ...input,
  });
  if (!team) throw new Error("Team not found");
  return team;
}

export async function upsertSeason(input: {
  name: string;
  leagueId: string;
  startDate: string | null;
  endDate: string | null;
  status: string;
}): Promise<{ dto: SeasonDto; created: boolean }> {
  return mutateConvex(refs.upsertSeason, input);
}

export async function subscribeToLeague(
  userId: string,
  leagueId: string,
): Promise<void> {
  await mutateConvex(refs.subscribeToLeague, { userId, leagueId });
}

export async function unsubscribeFromLeague(
  userId: string,
  leagueId: string,
): Promise<void> {
  await mutateConvex(refs.unsubscribeFromLeague, { userId, leagueId });
}

export async function readSyncConfig(): Promise<SyncConfig> {
  const config = await queryConvex(refs.getSyncConfig, {});
  let lastSyncReport: SyncReport | null = null;
  if (config.lastSyncReportJson) {
    try {
      lastSyncReport = JSON.parse(config.lastSyncReportJson) as SyncReport;
    } catch {
      lastSyncReport = null;
    }
  }

  return {
    syncEnabled: config.syncEnabled,
    lastSyncReport,
  };
}

export async function updateSyncEnabled(enabled: boolean): Promise<void> {
  await mutateConvex(refs.setSyncEnabled, { enabled });
}

export async function writeSyncReport(report: SyncReport): Promise<void> {
  await mutateConvex(refs.writeSyncReport, {
    reportJson: JSON.stringify(report),
  });
}

export async function getHealthSummary(): Promise<{
  leagues: number;
  divisions: number;
  teams: number;
  players: number;
  seasons: number;
}> {
  return queryConvex(refs.healthSummary, {});
}

export async function bulkImportLeague(
  payload: LeagueImportPayload,
  createdByUserId?: string,
  orgIdOverride?: string | null,
): Promise<ImportResult> {
  const errors: ImportError[] = [];
  const created = { leagues: 0, divisions: 0, teams: 0, players: 0 };
  const updated = { leagues: 0, divisions: 0, teams: 0, players: 0 };

  let orgId: string | null = orgIdOverride ?? null;
  const existingLeague = await getLeagueByName(payload.league.name);
  const existingLeagueOrgId = existingLeague
    ? await getLeagueOrgId(existingLeague.id)
    : null;

  if (existingLeagueOrgId && createdByUserId) {
    const { requireOrgAdmin } = await import("./org-context");
    await requireOrgAdmin(existingLeagueOrgId, createdByUserId);
  }

  if (orgIdOverride !== undefined) {
    orgId = orgIdOverride;
  } else if (!existingLeague && createdByUserId) {
    const client = await getClerkServerClient();
    const org = await client.organizations.createOrganization({
      name: payload.league.name,
      createdBy: createdByUserId,
    });
    orgId = org.id;
  } else {
    orgId = existingLeagueOrgId ?? null;
  }

  let leagueId: string;
  try {
    const leagueResult = await mutateConvex(refs.upsertLeague, {
      name: payload.league.name,
      orgId,
    });
    leagueId = leagueResult.dto.id;
    if (leagueResult.created) created.leagues++;
    else updated.leagues++;
  } catch (err) {
    throw new Error(
      `Failed to upsert league "${payload.league.name}": ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }

  for (const div of payload.divisions) {
    let divisionId: string;
    try {
      const divResult = await mutateConvex(refs.upsertDivision, {
        name: div.name,
        leagueId,
      });
      divisionId = divResult.dto.id;
      if (divResult.created) created.divisions++;
      else updated.divisions++;
    } catch (err) {
      errors.push({
        entity: "division",
        name: div.name,
        message: err instanceof Error ? err.message : String(err),
      });
      continue;
    }

    for (const team of div.teams) {
      let teamId: string;
      try {
        const teamResult = await mutateConvex(refs.upsertTeam, {
          name: team.name,
          city: team.city,
          stadium: team.stadium,
          leagueId,
          divisionId,
          logoUrl: team.logoUrl ?? null,
        });
        teamId = teamResult.dto.id;
        if (teamResult.created) created.teams++;
        else updated.teams++;
      } catch (err) {
        errors.push({
          entity: "team",
          name: team.name,
          message: err instanceof Error ? err.message : String(err),
        });
        continue;
      }

      for (const player of team.players) {
        try {
          const playerResult = await mutateConvex(refs.upsertPlayer, {
            name: player.name,
            leagueId,
            teamId,
            position: player.position,
            jerseyNumber: player.jerseyNumber ?? null,
            dateOfBirth: player.dateOfBirth ?? null,
            status: player.status ?? "Active",
            headshotUrl: player.headshotUrl ?? null,
          });
          if (playerResult.created) created.players++;
          else updated.players++;
        } catch (err) {
          errors.push({
            entity: "player",
            name: player.name,
            message: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }
  }

  return { leagueId, created, updated, errors };
}

export async function getDepthChartByTeamSeason(
  teamId: string,
  seasonId: string,
): Promise<DepthChartEntryDto[]> {
  return queryConvex(refs.getDepthChartByTeamSeason, { teamId, seasonId });
}

export async function reorderDepthChart(input: {
  teamId: string;
  seasonId: string;
  positionSlot: string;
  playerIds: string[];
}): Promise<DepthChartEntryDto[]> {
  return mutateConvex(refs.reorderDepthChart, input);
}

export async function setRosterLocked(
  seasonId: string,
  locked: boolean,
): Promise<{ seasonId: string; rosterLocked: boolean }> {
  return mutateConvex(refs.setRosterLocked, { seasonId, locked });
}

export async function getRosterBySeasonTeam(
  seasonId: string,
  teamId: string,
): Promise<RosterAssignmentDto[]> {
  return queryConvex(refs.getRosterBySeasonTeam, { seasonId, teamId });
}

export async function getTeamRosterLimitStatus(
  seasonId: string,
  teamId: string,
): Promise<{
  activeCount: number;
  rosterLimit: number | null;
  remaining: number | null;
}> {
  return queryConvex(refs.getTeamRosterLimitStatus, { seasonId, teamId });
}

export async function getRosterAssignmentHistory(input: {
  teamId: string;
  seasonId: string;
  playerId?: string | null;
  limit?: number | null;
}): Promise<RosterAuditLogDto[]> {
  return queryConvex(refs.getRosterAssignmentHistory, {
    teamId: input.teamId,
    seasonId: input.seasonId,
    playerId: input.playerId ?? null,
    limit: input.limit ?? null,
  });
}

export async function assignPlayerToRoster(input: {
  seasonId: string;
  teamId: string;
  playerId: string;
  positionSlot: string;
  actorUserId: string;
}): Promise<RosterAssignmentDto> {
  return mutateConvex(refs.assignPlayerToRoster, input);
}

export async function removePlayerFromRoster(input: {
  assignmentId: string;
  actorUserId: string;
}): Promise<null> {
  return mutateConvex(refs.removePlayerFromRoster, input);
}

export async function updateRosterStatus(input: {
  assignmentId: string;
  newStatus: string;
  actorUserId: string;
}): Promise<RosterAssignmentDto> {
  return mutateConvex(refs.updateRosterStatus, input);
}

import { normalizePff } from "./attributes/sources/pff";
import { normalizeMadden } from "./attributes/sources/madden";
import { normalizeAdminJson } from "./attributes/sources/admin-json";
import type { NormalizedSource } from "./attributes/sources/types";

const OVERALL_KEYS = ["overall", "OVR", "OVERALL", "Overall"];

function pickOverall(attributes: Record<string, number>): number | null {
  for (const key of OVERALL_KEYS) {
    if (typeof attributes[key] === "number") return attributes[key];
  }
  return null;
}

export interface IngestPlayerAttributesInput {
  playerId: string;
  seasonId: string;
  pffSource?: unknown;
  maddenSource?: unknown;
  adminSource?: unknown;
  /** Defaults to 0.5 each — wrapper renormalizes per actually-present source. */
  pffWeight?: number;
  maddenWeight?: number;
}

/**
 * Ingest a single playerAttributes row (Phase 2 / WSM-000057).
 *
 * The wrapper handles all source normalization client-side: each
 * raw payload is fed to its adapter, the resulting attribute maps are
 * blended into a canonical attributes map, and weightedOverall is
 * computed from the source overalls. Convex just persists the
 * canonical pieces.
 *
 * Idempotent: multiple calls with the same (playerId, seasonId) replace
 * the prior row.
 *
 * Throws when no source produces a normalized result for the player.
 */
export async function ingestPlayerAttributes(
  input: IngestPlayerAttributesInput,
): Promise<{ id: string; created: boolean }> {
  const sources: Array<{
    weight: number;
    normalized: NormalizedSource;
    raw: unknown;
    kind: "pff" | "madden" | "admin";
  }> = [];

  if (input.pffSource !== undefined) {
    const normalized = normalizePff(input.pffSource);
    if (normalized) {
      sources.push({
        weight: input.pffWeight ?? 0.5,
        normalized,
        raw: input.pffSource,
        kind: "pff",
      });
    }
  }
  if (input.maddenSource !== undefined) {
    const normalized = normalizeMadden(input.maddenSource);
    if (normalized) {
      sources.push({
        weight: input.maddenWeight ?? 0.5,
        normalized,
        raw: input.maddenSource,
        kind: "madden",
      });
    }
  }
  if (input.adminSource !== undefined) {
    const normalized = normalizeAdminJson(input.adminSource);
    if (normalized) {
      // Admin uploads override per-source weights — they're the canonical
      // authority. Use weight 1.0 and skip pff/madden weighting if admin
      // is the only source.
      sources.push({
        weight: 1.0,
        normalized,
        raw: input.adminSource,
        kind: "admin",
      });
    }
  }

  if (sources.length === 0) {
    throw new Error("ingest_no_valid_source");
  }

  // Use the first source's positionGroup. Sources should agree (same
  // player) but we don't enforce — picking the first keeps it deterministic.
  const positionGroup = sources[0].normalized.positionGroup;

  // Blend attribute maps. For each attribute key, weighted average across
  // sources that carry it.
  const attributes: Record<string, number> = {};
  const allKeys = new Set<string>();
  for (const s of sources) {
    for (const k of Object.keys(s.normalized.attributes)) allKeys.add(k);
  }
  for (const key of allKeys) {
    let weightedSum = 0;
    let totalWeight = 0;
    for (const s of sources) {
      const v = s.normalized.attributes[key];
      if (typeof v === "number") {
        weightedSum += v * s.weight;
        totalWeight += s.weight;
      }
    }
    if (totalWeight > 0) {
      attributes[key] = weightedSum / totalWeight;
    }
  }

  const weightedOverall = pickOverall(attributes);

  const pffSource = sources.find((s) => s.kind === "pff");
  const maddenSource = sources.find((s) => s.kind === "madden");

  return mutateConvex(refs.ingestPlayerAttributes, {
    playerId: input.playerId,
    seasonId: input.seasonId,
    positionGroup,
    attributesJson: JSON.stringify(attributes),
    pffSourceJson: pffSource ? JSON.stringify(pffSource.raw) : null,
    maddenSourceJson: maddenSource ? JSON.stringify(maddenSource.raw) : null,
    pffWeight: input.pffWeight ?? 0.5,
    maddenWeight: input.maddenWeight ?? 0.5,
    weightedOverall,
  });
}

export async function getPlayerDevelopment(playerId: string) {
  return queryConvex(refs.getPlayerDevelopment, { playerId });
}

export async function getSeasonAttributesByPosition(
  seasonId: string,
  positionGroup: string,
  limit?: number,
) {
  return queryConvex(refs.getSeasonAttributesByPosition, {
    seasonId,
    positionGroup,
    limit,
  });
}

export async function getLeagueVisibility(leagueId: string) {
  return queryConvex(refs.getLeagueVisibility, { leagueId });
}

export async function setLeaguePublic(
  leagueId: string,
  isPublic: boolean,
): Promise<void> {
  await mutateConvex(refs.setLeaguePublic, { leagueId, isPublic });
}

export async function getPlayerDevelopmentPublic(
  leagueId: string,
  playerId: string,
) {
  return queryConvex(refs.getPlayerDevelopmentPublic, { leagueId, playerId });
}

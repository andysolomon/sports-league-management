import { makeFunctionReference } from "convex/server";
import type {
  ConferenceDto,
  CreatePlayerInput,
  CreateTeamInput,
  DepthChartEntryDto,
  DivisionDto,
  FixtureDto,
  GameResultDto,
  ImportError,
  ImportResult,
  LeagueDto,
  PlayerDto,
  PlayerGameStatLine,
  PlayerGameStatsDto,
  RosterAssignmentDto,
  RosterAuditLogDto,
  SeasonDto,
  Standing,
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

/** A single bracket node (WSM-000164). Team/score fields are null until played. */
export interface PlayoffMatchupDto {
  id: string;
  round: number;
  slot: number;
  homeSeed: number | null;
  awaySeed: number | null;
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeTeamName: string | null;
  awayTeamName: string | null;
  winnerTeamId: string | null;
  fixtureId: string | null;
  status: string | null;
  homeScore: number | null;
  awayScore: number | null;
  /** "winners" | "losers" | "grandFinal" — null for single-elim brackets. */
  bracketType: string | null;
  /** First-round bye: the present team auto-advanced with no game. */
  isBye: boolean;
}

export interface PlayoffBracketDto {
  bracketId: string;
  size: number;
  rounds: number;
  /** "single" | "double". */
  format: string;
  matchups: PlayoffMatchupDto[];
}

/** Season stat-leaders (WSM-000186). */
export interface StatLeaderEntry {
  playerId: string;
  playerName: string;
  teamName: string;
  jerseyNumber: number | null;
  value: number;
}
export interface SeasonStatCategoryLeaders {
  key: string;
  label: string;
  leaders: StatLeaderEntry[];
}

const refs = {
  getVisibleLeagueContext: queryRef<
    { orgIds: string[]; userId: string },
    {
      visibleLeagueIds: string[];
      subscribedLeagueIds: string[];
      subscriptionScopes: Array<{ leagueId: string; teamIds: string[] }>;
    }
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
  listConferences: queryRef<{ leagueIds: string[] }, ConferenceDto[]>(
    "sports:listConferences",
  ),
  listTeams: queryRef<{ leagueIds: string[] }, TeamDto[]>("sports:listTeams"),
  listTeamsByLeague: queryRef<{ leagueId: string }, TeamDto[]>(
    "sports:listTeamsByLeague",
  ),
  getTeam: queryRef<{ teamId: string }, TeamDto | null>("sports:getTeam"),
  getTeamLeagueId: queryRef<{ teamId: string }, string | null>(
    "sports:getTeamLeagueId",
  ),
  getTeamOwnerOrgId: queryRef<{ teamId: string }, string | null>(
    "sports:getTeamOwnerOrgId",
  ),
  forkTeamToWorkspace: mutationRef<
    { orgId: string; sourceTeamId: string },
    { teamId: string; leagueId: string; created: boolean }
  >("sports:forkTeamToWorkspace"),
  unforkTeamFromWorkspace: mutationRef<
    { orgId: string; sourceTeamId: string },
    { removed: boolean }
  >("sports:unforkTeamFromWorkspace"),
  forkDivisionToWorkspace: mutationRef<
    { orgId: string; divisionId: string },
    {
      leagueId: string;
      totalTeams: number;
      forkedTeams: number;
      alreadyForked: number;
    }
  >("sports:forkDivisionToWorkspace"),
  forkConferenceToWorkspace: mutationRef<
    { orgId: string; conferenceId: string },
    {
      leagueId: string;
      totalTeams: number;
      forkedTeams: number;
      alreadyForked: number;
    }
  >("sports:forkConferenceToWorkspace"),
  getOrgForkedSourceTeamIds: queryRef<{ orgId: string }, string[]>(
    "sports:getOrgForkedSourceTeamIds",
  ),
  setLeagueClaimable: mutationRef<
    { leagueId: string; claimable: boolean },
    null
  >("sports:setLeagueClaimable"),
  getLeagueClaimable: queryRef<{ leagueId: string }, boolean>(
    "sports:getLeagueClaimable",
  ),
  getOrgMemberRole: queryRef<
    { orgId: string; userId: string },
    "coach" | "viewer" | null
  >("sports:getOrgMemberRole"),
  listOrgMemberRoles: queryRef<
    { orgId: string },
    Array<{ userId: string; role: "coach" | "viewer" }>
  >("sports:listOrgMemberRoles"),
  setOrgMemberRole: mutationRef<
    { orgId: string; userId: string; role: "coach" | "viewer" },
    null
  >("sports:setOrgMemberRole"),
  deleteOrgMemberRole: mutationRef<{ orgId: string; userId: string }, null>(
    "sports:deleteOrgMemberRole",
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
  adminPing: queryRef<Record<string, never>, boolean>("sports:adminPing"),
  upsertLeague: mutationRef<
    { name: string; orgId: string | null },
    { dto: LeagueDto; created: boolean }
  >("sports:upsertLeague"),
  createLeague: mutationRef<
    { name: string; orgId: string },
    { id: string; name: string }
  >("sports:createLeague"),
  renameLeague: mutationRef<{ leagueId: string; name: string }, null>(
    "sports:renameLeague",
  ),
  deleteLeagueBatch: mutationRef<
    { leagueId: string; maxTeams?: number },
    { done: boolean; teamsDeleted: number }
  >("sports:deleteLeagueBatch"),
  clearSeasonPlayerAttributes: mutationRef<
    { seasonId: string },
    { deleted: number }
  >("sports:clearSeasonPlayerAttributes"),
  ingestPlayerAttributesBatch: mutationRef<
    {
      seasonId: string;
      rows: Array<{
        playerId: string;
        positionGroup: string;
        attributesJson: string;
        weightedOverall: number | null;
      }>;
    },
    { created: number; updated: number }
  >("sports:ingestPlayerAttributesBatch"),
  upsertDivision: mutationRef<
    { name: string; leagueId: string },
    { dto: DivisionDto; created: boolean }
  >("sports:upsertDivision"),
  updateDivision: mutationRef<
    { divisionId: string; name: string },
    DivisionDto | null
  >("sports:updateDivision"),
  deleteDivision: mutationRef<
    { divisionId: string },
    { ok: boolean; teamCount: number }
  >("sports:deleteDivision"),
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
      experienceYears: number | null;
      grade: number | null;
      squad: string | null;
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
      playoffTeams?: number;
      playoffFormat?: string;
      divisionWinnersQualify?: boolean;
    },
    { dto: SeasonDto; created: boolean }
  >("sports:upsertSeason"),
  updateSeason: mutationRef<
    {
      seasonId: string;
      name: string;
      startDate: string | null;
      endDate: string | null;
      playoffTeams?: number;
      playoffFormat?: string;
      divisionWinnersQualify?: boolean;
    },
    SeasonDto | null
  >("sports:updateSeason"),
  setActiveSeason: mutationRef<{ seasonId: string }, null>(
    "sports:setActiveSeason",
  ),
  deleteSeason: mutationRef<{ seasonId: string }, null>("sports:deleteSeason"),
  setLeagueInviteToken: mutationRef<
    { leagueId: string; token: string | null },
    null
  >("sports:setLeagueInviteToken"),
  createTeam: mutationRef<CreateTeamInput, TeamDto>("sports:createTeam"),
  updateTeam: mutationRef<
    { teamId: string } & UpdateTeamInput,
    TeamDto | null
  >("sports:updateTeam"),
  createPlayer: mutationRef<CreatePlayerInput, PlayerDto>("sports:createPlayer"),
  bulkCreatePlayers: mutationRef<
    { teamId: string; players: BulkPlayerInput[] },
    { created: number }
  >("sports:bulkCreatePlayers"),
  clearSyntheticPlayers: mutationRef<
    { teamId: string },
    { deleted: number }
  >("sports:clearSyntheticPlayers"),
  updatePlayer: mutationRef<
    { playerId: string } & UpdatePlayerInput,
    PlayerDto | null
  >("sports:updatePlayer"),
  deletePlayer: mutationRef<{ playerId: string }, null>("sports:deletePlayer"),
  deleteTeam: mutationRef<{ teamId: string }, null>("sports:deleteTeam"),
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
  getPlayerSeasonAttributes: queryRef<
    { playerId: string },
    {
      weightedOverall: number | null;
      attributes: Record<string, number>;
      positionGroup: string;
    } | null
  >("sports:getPlayerSeasonAttributes"),
  getTeamAttributeSnapshots: queryRef<
    { teamId: string },
    Array<{
      playerId: string;
      weightedOverall: number | null;
      attributes: Record<string, number>;
    }>
  >("sports:getTeamAttributeSnapshots"),
  getPlayerMaddenRating: queryRef<
    { playerId: string },
    {
      overall: number;
      position: string;
      attributes: Record<string, number>;
      portraitUrl: string | null;
      teamLogoUrl: string | null;
    } | null
  >("sports:getPlayerMaddenRating"),
  getTeamMaddenOveralls: queryRef<
    { teamId: string },
    Array<{ playerId: string; overall: number }>
  >("sports:getTeamMaddenOveralls"),
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
  createFixture: mutationRef<
    {
      seasonId: string;
      homeTeamId: string;
      awayTeamId: string;
      scheduledAt: string | null;
      week: number | null;
      venue: string | null;
      actorUserId: string;
    },
    FixtureDto
  >("sports:createFixture"),
  updateFixture: mutationRef<
    {
      fixtureId: string;
      scheduledAt?: string | null;
      week?: number | null;
      venue?: string | null;
      status?: string;
    },
    FixtureDto | null
  >("sports:updateFixture"),
  deleteFixture: mutationRef<{ fixtureId: string }, null>(
    "sports:deleteFixture",
  ),
  generateSeasonSchedule: mutationRef<
    {
      seasonId: string;
      actorUserId: string;
      confirm?: boolean;
      format?: "single" | "double";
    },
    { created: number; weeks: number; teamCount: number }
  >("sports:generateSeasonSchedule"),
  copySeasonRosters: mutationRef<
    {
      targetSeasonId: string;
      sourceSeasonId?: string;
      actorUserId: string;
      confirm?: boolean;
    },
    {
      copiedAssignments: number;
      copiedDepthEntries: number;
      sourceSeasonId: string;
    }
  >("sports:copySeasonRosters"),
  generatePlayoffBracket: mutationRef<
    {
      seasonId: string;
      size: number;
      actorUserId: string;
      confirm?: boolean;
      divisionWinnersQualify?: boolean;
      format?: string;
    },
    { bracketId: string; size: number; rounds: number; matchups: number }
  >("sports:generatePlayoffBracket"),
  getPlayoffBracket: queryRef<{ seasonId: string }, PlayoffBracketDto | null>(
    "sports:getPlayoffBracket",
  ),
  listFixturesBySeason: queryRef<{ seasonId: string }, FixtureDto[]>(
    "sports:listFixturesBySeason",
  ),
  getFixture: queryRef<{ fixtureId: string }, FixtureDto | null>(
    "sports:getFixture",
  ),
  recordGameResult: mutationRef<
    {
      fixtureId: string;
      homeScore: number;
      awayScore: number;
      actorUserId: string;
    },
    GameResultDto
  >("sports:recordGameResult"),
  getResultByFixture: queryRef<{ fixtureId: string }, GameResultDto | null>(
    "sports:getResultByFixture",
  ),
  computeStandings: queryRef<{ seasonId: string }, Standing[]>(
    "sports:computeStandings",
  ),
  computeDivisionStandings: queryRef<
    { seasonId: string; divisionId: string },
    Standing[]
  >("sports:computeDivisionStandings"),
  computeStandingsPublic: queryRef<
    { leagueId: string },
    { seasonName: string; rows: Standing[] } | null
  >("sports:computeStandingsPublic"),
  createGameStream: mutationRef<
    {
      fixtureId: string;
      provider?: string;
      muxLiveStreamId?: string;
      muxPlaybackId?: string;
      youtubeVideoId?: string | null;
      startedBy: string;
      maxDurationMinutes: number;
    },
    { id: string; fixtureId: string; status: string }
  >("sports:createGameStream"),
  endGameStreamByFixture: mutationRef<
    { fixtureId: string; endedAt: string },
    boolean
  >("sports:endGameStreamByFixture"),
  updateGameStreamStatus: mutationRef<
    {
      muxLiveStreamId: string;
      status?: string;
      vodAssetId?: string | null;
      endedAt?: string | null;
    },
    boolean
  >("sports:updateGameStreamStatus"),
  getStreamByFixture: queryRef<
    { fixtureId: string },
    PublicGameStream | null
  >("sports:getStreamByFixture"),
  getActiveStreamCountForLeague: queryRef<{ leagueId: string }, number>(
    "sports:getActiveStreamCountForLeague",
  ),
  // Internal query (not on public api) — admin-keyed server code only.
  getStreamAdminByFixture: queryRef<
    { fixtureId: string },
    { provider: string; muxLiveStreamId: string | null; status: string } | null
  >("sports:getStreamAdminByFixture"),
  // Stat-keeping keystone (WSM-000112)
  upsertPlayerGameStats: mutationRef<
    {
      fixtureId: string;
      playerId: string;
      teamId: string;
      seasonId: string;
      statsJson: string;
      actorUserId: string;
    },
    { id: string }
  >("sports:upsertPlayerGameStats"),
  deletePlayerGameStats: mutationRef<
    { fixtureId: string; playerId: string },
    boolean
  >("sports:deletePlayerGameStats"),
  getPlayerGameStatsByFixture: queryRef<
    { fixtureId: string },
    PlayerGameStatsRow[]
  >("sports:getPlayerGameStatsByFixture"),
  getPlayerSeasonTotals: queryRef<
    { playerId: string; seasonId: string },
    { statsJson: string; gameCount: number }
  >("sports:getPlayerSeasonTotals"),
  computeSeasonSprt: queryRef<
    { seasonId: string },
    Array<{
      playerId: string;
      positionGroup: string;
      overall: number;
      attributesJson: string;
    }>
  >("sports:computeSeasonSprt"),
  getSeasonStatLeaders: queryRef<
    { seasonId: string },
    SeasonStatCategoryLeaders[]
  >("sports:getSeasonStatLeaders"),
  // Live game-state (WSM-000152, keystone v3)
  startLiveGame: mutationRef<
    { fixtureId: string; actorUserId: string },
    LiveGameStateDto
  >("sports:startLiveGame"),
  addLiveScore: mutationRef<
    { fixtureId: string; team: "home" | "away"; points: number },
    LiveGameStateDto
  >("sports:addLiveScore"),
  setLiveScore: mutationRef<
    { fixtureId: string; homeScore: number; awayScore: number },
    LiveGameStateDto
  >("sports:setLiveScore"),
  updateLiveState: mutationRef<
    {
      fixtureId: string;
      period?: number;
      clock?: string | null;
      status?: string;
    },
    LiveGameStateDto
  >("sports:updateLiveState"),
  endLiveGame: mutationRef<
    { fixtureId: string; actorUserId: string },
    LiveGameStateDto
  >("sports:endLiveGame"),
  getLiveGameState: queryRef<
    { fixtureId: string },
    LiveGameStatePublic | null
  >("sports:getLiveGameState"),
};

/** Full live game-state (operator UI). */
export interface LiveGameStateDto {
  id: string;
  fixtureId: string;
  homeScore: number;
  awayScore: number;
  period: number;
  clock: string | null;
  status: string;
  startedBy: string;
  startedAt: string;
  updatedAt: string;
}

/** Public projection of live game-state — the seam #302's overlay consumes. */
export interface LiveGameStatePublic {
  homeScore: number;
  awayScore: number;
  period: number;
  clock: string | null;
  status: string;
}

/** Raw playerGameStats row as returned by Convex (statsJson unparsed). */
interface PlayerGameStatsRow {
  id: string;
  fixtureId: string;
  playerId: string;
  teamId: string;
  seasonId: string;
  statsJson: string;
  enteredBy: string;
  updatedAt: string;
}

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

/**
 * Teams + divisions + conferences for a PUBLIC league's à la carte import tree
 * (WSM-000100 / WSM-000133). The league id must come from getPublicLeagues —
 * public leagues are browseable for import, so there's no org-access gate here.
 * Conferences (where present) form the top tier of the discover hierarchy.
 */
export async function getPublicLeagueImportTree(leagueId: string): Promise<{
  teams: TeamDto[];
  divisions: DivisionDto[];
  conferences: ConferenceDto[];
}> {
  const [teams, divisions, conferences] = await Promise.all([
    queryConvex(refs.listTeamsByLeague, { leagueId }),
    queryConvex(refs.listDivisions, { leagueIds: [leagueId] }),
    queryConvex(refs.listConferences, { leagueIds: [leagueId] }),
  ]);
  return { teams, divisions, conferences };
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

/** WSM-000118: league CRUD. Auth enforced in the calling server actions. */
export async function createLeague(
  name: string,
  orgId: string,
): Promise<{ id: string; name: string }> {
  return mutateConvex(refs.createLeague, { name, orgId });
}

export async function renameLeague(
  leagueId: string,
  name: string,
): Promise<void> {
  await mutateConvex(refs.renameLeague, { leagueId, name });
}

/**
 * Delete a league, batching the cascade over teams so a large forked league
 * (NFL ~2,900 players) stays inside Convex mutation limits (WSM-000122). Loops
 * until the backend reports `done`; a generous iteration cap guards against an
 * unexpected non-terminating response.
 */
export async function deleteLeague(leagueId: string): Promise<void> {
  // ~10 teams/batch keeps each transaction comfortably bounded (a forked
  // 32-team league finishes in ~4 round trips); the cap (400) covers leagues
  // far larger than anything real before it would ever trip.
  for (let i = 0; i < 400; i++) {
    const { done } = await mutateConvex(refs.deleteLeagueBatch, {
      leagueId,
      maxTeams: 10,
    });
    if (done) return;
  }
  throw new Error("deleteLeague did not complete within the batch limit");
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

export async function createDivision(input: {
  name: string;
  leagueId: string;
}): Promise<{ dto: DivisionDto; created: boolean }> {
  return mutateConvex(refs.upsertDivision, input);
}

export async function updateDivision(input: {
  divisionId: string;
  name: string;
}): Promise<DivisionDto> {
  const dto = await mutateConvex(refs.updateDivision, input);
  if (!dto) throw new Error("Division not found");
  return dto;
}

export async function deleteDivision(
  divisionId: string,
): Promise<{ ok: boolean; teamCount: number }> {
  return mutateConvex(refs.deleteDivision, { divisionId });
}

/** Resolve a division's league for authorization, without an org-access gate. */
export async function getDivisionLeagueId(
  divisionId: string,
): Promise<string | null> {
  const division = await queryConvex(refs.getDivision, { divisionId });
  return division?.leagueId ?? null;
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

/** WSM-000109: the org that claimed this team, or null if unclaimed. */
export async function getTeamOwnerOrgId(
  teamId: string,
): Promise<string | null> {
  return queryConvex(refs.getTeamOwnerOrgId, { teamId });
}

/**
 * WSM-000114: fork a reference team into the org's private workspace. Raw
 * wrapper — caller MUST verify org admin first (see forkTeamForOrg).
 */
export async function forkTeamToWorkspace(
  orgId: string,
  sourceTeamId: string,
): Promise<{ teamId: string; leagueId: string; created: boolean }> {
  return mutateConvex(refs.forkTeamToWorkspace, { orgId, sourceTeamId });
}

/**
 * WSM-000129: reverse of forkTeamToWorkspace — delete the org's private fork of
 * a reference team (the team whose sourceTeamId matches, plus its roster). Raw
 * wrapper — caller MUST resolve an org the user admins first.
 */
export async function unforkTeamFromWorkspace(
  orgId: string,
  sourceTeamId: string,
): Promise<{ removed: boolean }> {
  return mutateConvex(refs.unforkTeamFromWorkspace, { orgId, sourceTeamId });
}

/**
 * WSM-000133: fork EVERY team in a reference division into the org's workspace
 * in one idempotent batch. Raw wrapper — caller MUST verify org admin first.
 */
export async function forkDivisionToWorkspace(
  orgId: string,
  divisionId: string,
): Promise<{
  leagueId: string;
  totalTeams: number;
  forkedTeams: number;
  alreadyForked: number;
}> {
  return mutateConvex(refs.forkDivisionToWorkspace, { orgId, divisionId });
}

/**
 * WSM-000133: fork every team under a reference conference (all its divisions)
 * into the org's workspace, idempotently. Raw wrapper — verify org admin first.
 */
export async function forkConferenceToWorkspace(
  orgId: string,
  conferenceId: string,
): Promise<{
  leagueId: string;
  totalTeams: number;
  forkedTeams: number;
  alreadyForked: number;
}> {
  return mutateConvex(refs.forkConferenceToWorkspace, { orgId, conferenceId });
}

/** WSM-000117: reference team ids the org has already forked (for Discover). */
export async function getOrgForkedSourceTeamIds(
  orgId: string,
): Promise<string[]> {
  return queryConvex(refs.getOrgForkedSourceTeamIds, { orgId });
}

export async function setLeagueClaimable(
  leagueId: string,
  claimable: boolean,
): Promise<void> {
  await mutateConvex(refs.setLeagueClaimable, { leagueId, claimable });
}

/** WSM-000109: whether a league's teams can be claimed by coaches. */
export async function getLeagueClaimable(leagueId: string): Promise<boolean> {
  return queryConvex(refs.getLeagueClaimable, { leagueId });
}

/** WSM-000121: a member's coach/viewer sub-role (null = viewer default). */
export async function getOrgMemberRole(
  orgId: string,
  userId: string,
): Promise<"coach" | "viewer" | null> {
  return queryConvex(refs.getOrgMemberRole, { orgId, userId });
}

export async function listOrgMemberRoles(
  orgId: string,
): Promise<Array<{ userId: string; role: "coach" | "viewer" }>> {
  return queryConvex(refs.listOrgMemberRoles, { orgId });
}

export async function setOrgMemberRole(
  orgId: string,
  userId: string,
  role: "coach" | "viewer",
): Promise<void> {
  await mutateConvex(refs.setOrgMemberRole, { orgId, userId, role });
}

export async function deleteOrgMemberRole(
  orgId: string,
  userId: string,
): Promise<void> {
  await mutateConvex(refs.deleteOrgMemberRole, { orgId, userId });
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

/** WSM-000093: one player's SPRT snapshot for the profile breakdown. The
 *  season is resolved server-side (the source season for workspace forks),
 *  so callers no longer pass one (WSM-000122). */
export async function getPlayerSeasonAttributes(
  playerId: string,
  orgContext: OrgContext,
): Promise<{
  weightedOverall: number | null;
  attributes: Record<string, number>;
  positionGroup: string;
} | null> {
  const player = await queryConvex(refs.getPlayer, { playerId });
  if (!player) return null;
  const teamLeagueId = await getTeamLeagueId(player.teamId);
  requireLeagueAccessLocal(teamLeagueId, orgContext);
  return queryConvex(refs.getPlayerSeasonAttributes, { playerId });
}

/** WSM-000090: playerId → snapshot map for the roster stat columns. Season
 *  resolved server-side, including workspace forks (WSM-000122). */
export async function getTeamAttributeSnapshots(
  teamId: string,
  orgContext: OrgContext,
): Promise<
  Map<string, { weightedOverall: number | null; attributes: Record<string, number> }>
> {
  const teamLeagueId = await getTeamLeagueId(teamId);
  requireLeagueAccessLocal(teamLeagueId, orgContext);
  const rows = await queryConvex(refs.getTeamAttributeSnapshots, { teamId });
  return new Map(
    rows.map((r) => [
      r.playerId,
      { weightedOverall: r.weightedOverall, attributes: r.attributes },
    ]),
  );
}

/** WSM-000095: one player's Madden snapshot for the profile card. */
export async function getPlayerMaddenRating(
  playerId: string,
  orgContext: OrgContext,
): Promise<{
  overall: number;
  position: string;
  attributes: Record<string, number>;
  portraitUrl: string | null;
  teamLogoUrl: string | null;
} | null> {
  const player = await queryConvex(refs.getPlayer, { playerId });
  if (!player) return null;
  const teamLeagueId = await getTeamLeagueId(player.teamId);
  requireLeagueAccessLocal(teamLeagueId, orgContext);
  return queryConvex(refs.getPlayerMaddenRating, { playerId });
}

/** WSM-000095: playerId → Madden overall map for the roster MAD column. */
export async function getTeamMaddenOveralls(
  teamId: string,
  orgContext: OrgContext,
): Promise<Map<string, number>> {
  const teamLeagueId = await getTeamLeagueId(teamId);
  requireLeagueAccessLocal(teamLeagueId, orgContext);
  const rows = await queryConvex(refs.getTeamMaddenOveralls, { teamId });
  return new Map(rows.map((r) => [r.playerId, r.overall]));
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

/** A synthetic player row for bulk insert (WSM-000173). */
export interface BulkPlayerInput {
  name: string;
  position: string;
  jerseyNumber: number | null;
  status: string;
  grade?: number | null;
  squad?: string | null;
  dateOfBirth?: string | null;
  hometown?: string | null;
}

export async function bulkCreatePlayers(
  teamId: string,
  players: BulkPlayerInput[],
): Promise<{ created: number }> {
  return mutateConvex(refs.bulkCreatePlayers, { teamId, players });
}

export async function clearSyntheticPlayers(
  teamId: string,
): Promise<{ deleted: number }> {
  return mutateConvex(refs.clearSyntheticPlayers, { teamId });
}

/** A precomputed attribute snapshot for bulk ingest (WSM-000175). */
export interface AttributeBatchRow {
  playerId: string;
  positionGroup: string;
  attributesJson: string;
  weightedOverall: number | null;
}

/** Upsert many players' season attribute snapshots in one call (WSM-000175). */
export async function ingestPlayerAttributesBatch(
  seasonId: string,
  rows: AttributeBatchRow[],
): Promise<{ created: number; updated: number }> {
  return mutateConvex(refs.ingestPlayerAttributesBatch, { seasonId, rows });
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

export async function deleteTeam(id: string): Promise<null> {
  return mutateConvex(refs.deleteTeam, { teamId: id });
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
  playoffTeams?: number;
  playoffFormat?: string;
  divisionWinnersQualify?: boolean;
}): Promise<{ dto: SeasonDto; created: boolean }> {
  return mutateConvex(refs.upsertSeason, input);
}

export async function updateSeason(input: {
  seasonId: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
  playoffTeams?: number;
  playoffFormat?: string;
  divisionWinnersQualify?: boolean;
}): Promise<SeasonDto> {
  const dto = await mutateConvex(refs.updateSeason, input);
  if (!dto) throw new Error("Season not found");
  return dto;
}

export async function setActiveSeason(seasonId: string): Promise<null> {
  return mutateConvex(refs.setActiveSeason, { seasonId });
}

export async function deleteSeason(seasonId: string): Promise<null> {
  return mutateConvex(refs.deleteSeason, { seasonId });
}

/** Resolve a season's league for authorization, without an org-access gate. */
export async function getSeasonLeagueId(
  seasonId: string,
): Promise<string | null> {
  const season = await queryConvex(refs.getSeason, { seasonId });
  return season?.leagueId ?? null;
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

/** Admin-auth probe (WSM-000151): resolves true only if the admin-keyed client
 *  authenticates as admin; throws otherwise. Used by /api/health. */
export async function adminPing(): Promise<boolean> {
  return queryConvex(refs.adminPing, {});
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
            experienceYears: player.experienceYears ?? null,
            grade: player.grade ?? null,
            squad: player.squad ?? null,
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

// --- Phase 3 (schedules_standings_v1) — fixture CRUD wrappers ---

export interface CreateFixtureInput {
  seasonId: string;
  homeTeamId: string;
  awayTeamId: string;
  scheduledAt: string | null;
  week: number | null;
  venue: string | null;
  actorUserId: string;
}

export async function createFixture(
  input: CreateFixtureInput,
): Promise<FixtureDto> {
  return mutateConvex(refs.createFixture, input);
}

export async function updateFixture(input: {
  fixtureId: string;
  scheduledAt?: string | null;
  week?: number | null;
  venue?: string | null;
  status?: string;
}): Promise<FixtureDto | null> {
  return mutateConvex(refs.updateFixture, input);
}

export async function deleteFixture(fixtureId: string): Promise<void> {
  await mutateConvex(refs.deleteFixture, { fixtureId });
}

export async function generateSeasonSchedule(input: {
  seasonId: string;
  actorUserId: string;
  confirm?: boolean;
  format?: "single" | "double";
}): Promise<{ created: number; weeks: number; teamCount: number }> {
  return mutateConvex(refs.generateSeasonSchedule, input);
}

export async function copySeasonRosters(input: {
  targetSeasonId: string;
  sourceSeasonId?: string;
  actorUserId: string;
  confirm?: boolean;
}): Promise<{
  copiedAssignments: number;
  copiedDepthEntries: number;
  sourceSeasonId: string;
}> {
  return mutateConvex(refs.copySeasonRosters, input);
}

export async function generatePlayoffBracket(input: {
  seasonId: string;
  size: number;
  actorUserId: string;
  confirm?: boolean;
  divisionWinnersQualify?: boolean;
  format?: string;
}): Promise<{
  bracketId: string;
  size: number;
  rounds: number;
  matchups: number;
}> {
  return mutateConvex(refs.generatePlayoffBracket, input);
}

export async function getPlayoffBracket(
  seasonId: string,
): Promise<PlayoffBracketDto | null> {
  return queryConvex(refs.getPlayoffBracket, { seasonId });
}

export async function listFixturesBySeason(
  seasonId: string,
): Promise<FixtureDto[]> {
  return queryConvex(refs.listFixturesBySeason, { seasonId });
}

export async function getFixture(
  fixtureId: string,
): Promise<FixtureDto | null> {
  return queryConvex(refs.getFixture, { fixtureId });
}

// --- Phase 3 — game result wrappers ---

export interface RecordGameResultInput {
  fixtureId: string;
  homeScore: number;
  awayScore: number;
  actorUserId: string;
}

export async function recordGameResult(
  input: RecordGameResultInput,
): Promise<GameResultDto> {
  return mutateConvex(refs.recordGameResult, input);
}

export async function getResultByFixture(
  fixtureId: string,
): Promise<GameResultDto | null> {
  return queryConvex(refs.getResultByFixture, { fixtureId });
}

// --- Phase 1 live streaming wrappers (WSM-000144) ---

/** Public projection of a game stream — what an unauthenticated viewer sees.
 *  Never carries the Mux live-stream id or stream key. Provider-agnostic:
 *  `provider` selects which public playback id is populated. */
export interface PublicGameStream {
  status: string; // "idle" | "active" | "ended"
  provider: string; // "mux" | "youtube"
  muxPlaybackId: string | null;
  youtubeVideoId: string | null;
  vodAssetId: string | null;
}

export interface CreateGameStreamInput {
  fixtureId: string;
  provider?: string; // "mux" (default) | "youtube"
  muxLiveStreamId?: string;
  muxPlaybackId?: string;
  youtubeVideoId?: string | null;
  startedBy: string;
  maxDurationMinutes: number;
}

export async function createGameStream(
  input: CreateGameStreamInput,
): Promise<{
  id: string;
  fixtureId: string;
  status: string;
}> {
  return mutateConvex(refs.createGameStream, input);
}

/** Mark a fixture's stream ended (YouTube stop — no Mux webhook to flip it). */
export async function endGameStreamByFixture(
  fixtureId: string,
  endedAt: string,
): Promise<boolean> {
  return mutateConvex(refs.endGameStreamByFixture, { fixtureId, endedAt });
}

export async function updateGameStreamStatus(input: {
  muxLiveStreamId: string;
  status?: string;
  vodAssetId?: string | null;
  endedAt?: string | null;
}): Promise<boolean> {
  return mutateConvex(refs.updateGameStreamStatus, input);
}

/** Public read — projects to public fields only (status/playbackId/vodAssetId). */
export async function getStreamByFixture(
  fixtureId: string,
): Promise<PublicGameStream | null> {
  return queryConvex(refs.getStreamByFixture, { fixtureId });
}

export async function getActiveStreamCountForLeague(
  leagueId: string,
): Promise<number> {
  return queryConvex(refs.getActiveStreamCountForLeague, { leagueId });
}

/** Internal admin read — returns the server-side Mux live-stream id so a server
 *  action can disable/transition it. Admin-keyed; not a public projection. */
export async function getStreamAdminByFixture(
  fixtureId: string,
): Promise<{
  provider: string;
  muxLiveStreamId: string | null;
  status: string;
} | null> {
  return queryConvex(refs.getStreamAdminByFixture, { fixtureId });
}

// --- Stat-keeping keystone wrappers (WSM-000112) ---

function parseStatLine(json: string): PlayerGameStatLine {
  try {
    const v = JSON.parse(json);
    return v && typeof v === "object" ? (v as PlayerGameStatLine) : {};
  } catch {
    return {};
  }
}

export interface UpsertPlayerGameStatsInput {
  fixtureId: string;
  playerId: string;
  teamId: string;
  seasonId: string;
  stats: PlayerGameStatLine;
  actorUserId: string;
}

export async function upsertPlayerGameStats(
  input: UpsertPlayerGameStatsInput,
): Promise<{ id: string }> {
  return mutateConvex(refs.upsertPlayerGameStats, {
    fixtureId: input.fixtureId,
    playerId: input.playerId,
    teamId: input.teamId,
    seasonId: input.seasonId,
    statsJson: JSON.stringify(input.stats),
    actorUserId: input.actorUserId,
  });
}

export async function deletePlayerGameStats(
  fixtureId: string,
  playerId: string,
): Promise<boolean> {
  return mutateConvex(refs.deletePlayerGameStats, { fixtureId, playerId });
}

export async function getPlayerGameStatsByFixture(
  fixtureId: string,
): Promise<PlayerGameStatsDto[]> {
  const rows = await queryConvex(refs.getPlayerGameStatsByFixture, { fixtureId });
  return rows.map((r) => ({
    id: r.id,
    fixtureId: r.fixtureId,
    playerId: r.playerId,
    teamId: r.teamId,
    seasonId: r.seasonId,
    stats: parseStatLine(r.statsJson),
    enteredBy: r.enteredBy,
    updatedAt: r.updatedAt,
  }));
}

export async function getPlayerSeasonTotals(
  playerId: string,
  seasonId: string,
): Promise<{ stats: PlayerGameStatLine; gameCount: number }> {
  const res = await queryConvex(refs.getPlayerSeasonTotals, { playerId, seasonId });
  return { stats: parseStatLine(res.statsJson), gameCount: res.gameCount };
}

/** Season stat-leaders per category (WSM-000186). Server-side read; callers
 *  resolve the season via getSeason first, which enforces league access. */
export async function getSeasonStatLeaders(
  seasonId: string,
): Promise<SeasonStatCategoryLeaders[]> {
  return queryConvex(refs.getSeasonStatLeaders, { seasonId });
}

export interface HsSprtRating {
  playerId: string;
  positionGroup: string;
  overall: number;
  attributes: Record<string, number>;
}

/** Season-wide HS SPRT ratings from entered game stats (rated players only). */
export async function computeSeasonSprt(
  seasonId: string,
): Promise<HsSprtRating[]> {
  const rows = await queryConvex(refs.computeSeasonSprt, { seasonId });
  return rows.map((r) => {
    let attributes: Record<string, number> = {};
    try {
      const parsed = JSON.parse(r.attributesJson);
      if (parsed && typeof parsed === "object") attributes = parsed;
    } catch {
      // leave empty
    }
    return {
      playerId: r.playerId,
      positionGroup: r.positionGroup,
      overall: r.overall,
      attributes,
    };
  });
}

// --- Live game-state wrappers (WSM-000152, keystone v3) ---

export async function startLiveGame(
  fixtureId: string,
  actorUserId: string,
): Promise<LiveGameStateDto> {
  return mutateConvex(refs.startLiveGame, { fixtureId, actorUserId });
}

export async function addLiveScore(
  fixtureId: string,
  team: "home" | "away",
  points: number,
): Promise<LiveGameStateDto> {
  return mutateConvex(refs.addLiveScore, { fixtureId, team, points });
}

export async function setLiveScore(
  fixtureId: string,
  homeScore: number,
  awayScore: number,
): Promise<LiveGameStateDto> {
  return mutateConvex(refs.setLiveScore, { fixtureId, homeScore, awayScore });
}

export async function updateLiveState(
  fixtureId: string,
  patch: { period?: number; clock?: string | null; status?: string },
): Promise<LiveGameStateDto> {
  return mutateConvex(refs.updateLiveState, { fixtureId, ...patch });
}

export async function endLiveGame(
  fixtureId: string,
  actorUserId: string,
): Promise<LiveGameStateDto> {
  return mutateConvex(refs.endLiveGame, { fixtureId, actorUserId });
}

/** Public live game-state (the seam #302's overlay + the public page poll). */
export async function getLiveGameState(
  fixtureId: string,
): Promise<LiveGameStatePublic | null> {
  return queryConvex(refs.getLiveGameState, { fixtureId });
}

// --- Phase 3 — standings wrappers ---

export async function computeStandings(seasonId: string): Promise<Standing[]> {
  return queryConvex(refs.computeStandings, { seasonId });
}

export async function computeDivisionStandings(
  seasonId: string,
  divisionId: string,
): Promise<Standing[]> {
  return queryConvex(refs.computeDivisionStandings, { seasonId, divisionId });
}

export async function computeStandingsPublic(
  leagueId: string,
): Promise<{ seasonName: string; rows: Standing[] } | null> {
  return queryConvex(refs.computeStandingsPublic, { leagueId });
}

// --- Public game viewer (WSM-000143) — ungated reads for /leagues/[id]/games ---

/**
 * Ungated season lookup for public viewer routes. Unlike `getSeason`, this does
 * NOT enforce `requireLeagueAccessLocal`, so it's callable without an org
 * session. Used by the public game page to verify a fixture's season actually
 * belongs to the public league in the URL (a cross-league leak guard — a
 * fixture id from a PRIVATE league must not render under a public league's
 * path). Always pair the returned `leagueId` with `publicLeagueGuard`.
 */
export async function getPublicSeason(
  seasonId: string,
): Promise<SeasonDto | null> {
  return queryConvex(refs.getSeason, { seasonId });
}

export interface PublicScheduleRow {
  fixture: FixtureDto;
  result: GameResultDto | null;
}

/**
 * The active season's fixtures for a public league, enriched with final scores.
 *
 * Mirrors `computeStandingsPublic`'s season selection (status "active", else the
 * first season) so the public Schedule and Standings always agree on which
 * season they're showing. Composed entirely from ungated reads; call only after
 * `publicLeagueGuard` has confirmed the league is public. Returns null when the
 * league has no seasons.
 */
export async function getPublicLeagueSchedule(leagueId: string): Promise<{
  seasonName: string;
  rows: PublicScheduleRow[];
} | null> {
  const seasons = await queryConvex(refs.listSeasons, {
    leagueIds: [leagueId],
  });
  if (seasons.length === 0) return null;

  const season = seasons.find((s) => s.status === "active") ?? seasons[0];
  const fixtures = await listFixturesBySeason(season.id);

  // Pull final scores only for completed games (others have no result row).
  const rows = await Promise.all(
    fixtures.map(async (fixture) => ({
      fixture,
      result:
        fixture.status === "final"
          ? await getResultByFixture(fixture.id)
          : null,
    })),
  );

  return { seasonName: season.name, rows };
}

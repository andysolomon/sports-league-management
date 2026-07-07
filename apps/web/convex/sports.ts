import {
  internalMutationGeneric,
  internalQueryGeneric,
  queryGeneric,
} from "convex/server";
import { v, type Infer } from "convex/values";
import { internalMutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { writeAuditLog } from "./lib/auditLog";
import { computeStandingsPure } from "./lib/standings";
import { aggregateStatLines, parseStatLine } from "./lib/playerStats";
import {
  categoryValues,
  computeStatLeaders,
  type LeaderInput,
} from "./lib/statLeaders";
import {
  computeHsSprtRatings,
  positionToRatingGroup,
  type HsRatingInput,
} from "./lib/hsSprt";
import { applyScore, isLiveStatus, isNonNegInt } from "./lib/liveScore";
import {
  roundRobinSchedule,
  doubleRoundRobinSchedule,
  weekKickoff,
} from "./lib/roundRobin";
import {
  buildBracket,
  buildDoubleElimBracket,
  nextPowerOfTwo,
} from "./lib/bracket";
import { squadForGrade } from "./lib/dynasty";
import {
  targetRosterSize,
} from "./lib/offseason";
import { pickRound, teamOnClock } from "./lib/draft";

function uniqueById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    result.push(item);
  }
  return result;
}

function sortByName<T extends { name: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.name.localeCompare(b.name));
}

function toLeagueDto(doc: {
  _id: string;
  name: string;
  orgId: string | null;
}) {
  return {
    id: doc._id,
    name: doc.name,
    orgId: doc.orgId ?? null,
  };
}

function toConferenceDto(doc: {
  _id: string;
  name: string;
  leagueId: string;
}) {
  return {
    id: doc._id,
    name: doc.name,
    leagueId: doc.leagueId,
  };
}

function toDivisionDto(doc: {
  _id: string;
  name: string;
  leagueId: string;
  conferenceId?: string | null;
}) {
  return {
    id: doc._id,
    name: doc.name,
    leagueId: doc.leagueId,
    conferenceId: doc.conferenceId ?? null,
  };
}

function toTeamDto(doc: {
  _id: string;
  name: string;
  leagueId: string;
  city: string;
  stadium: string;
  foundedYear: number | null;
  location: string;
  divisionId: string | null;
  logoUrl: string | null;
  rosterLimit?: number | null;
  teamName?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  allowDuplicateJerseys?: boolean;
  maxprepsSupplierId?: string | null;
}) {
  return {
    id: doc._id,
    name: doc.name,
    leagueId: doc.leagueId,
    city: doc.city,
    stadium: doc.stadium,
    foundedYear: doc.foundedYear ?? null,
    location: doc.location,
    divisionId: doc.divisionId ?? "",
    logoUrl: doc.logoUrl ?? null,
    rosterLimit: doc.rosterLimit ?? null,
    teamName: doc.teamName ?? null,
    primaryColor: doc.primaryColor ?? null,
    secondaryColor: doc.secondaryColor ?? null,
    // Default true preserves the historical allow-by-default behavior.
    allowDuplicateJerseys: doc.allowDuplicateJerseys ?? true,
    maxprepsSupplierId: doc.maxprepsSupplierId ?? null,
  };
}

/*
 * Single source of truth for the player DTO shape (WSM-000167). Reused by every
 * player query/mutation `returns` validator, and `toPlayerDto`'s return type is
 * pinned to it via `Infer` below — so the mapper and the validators can't drift.
 * The WSM-000166 prod outage was exactly that drift (the DTO grew grade/squad
 * but the read validators didn't); this turns that class of bug into a tsc error.
 */
export const playerDtoValidator = v.object({
  id: v.string(),
  name: v.string(),
  teamId: v.string(),
  position: v.string(),
  positionGroup: v.union(v.string(), v.null()),
  jerseyNumber: v.union(v.number(), v.null()),
  dateOfBirth: v.union(v.string(), v.null()),
  status: v.string(),
  headshotUrl: v.union(v.string(), v.null()),
  experienceYears: v.union(v.number(), v.null()),
  grade: v.union(v.number(), v.null()),
  squad: v.union(v.string(), v.null()),
  hometown: v.union(v.string(), v.null()),
});

function toPlayerDto(doc: {
  _id: string;
  name: string;
  teamId: string;
  position: string;
  positionGroup?: string | null;
  jerseyNumber: number | null;
  dateOfBirth: string | null;
  status: string;
  headshotUrl: string | null;
  experienceYears?: number | null;
  grade?: number | null;
  squad?: string | null;
  hometown?: string | null;
}): Infer<typeof playerDtoValidator> {
  return {
    id: doc._id,
    name: doc.name,
    teamId: doc.teamId,
    position: doc.position,
    positionGroup: doc.positionGroup ?? null,
    jerseyNumber: doc.jerseyNumber ?? null,
    dateOfBirth: doc.dateOfBirth ?? null,
    status: doc.status,
    headshotUrl: doc.headshotUrl ?? null,
    experienceYears: doc.experienceYears ?? null,
    grade: doc.grade ?? null,
    squad: doc.squad ?? null,
    hometown: doc.hometown ?? null,
  };
}

function toSeasonDto(doc: {
  _id: string;
  name: string;
  leagueId: string;
  startDate: string | null;
  endDate: string | null;
  status: string;
  rosterLocked?: boolean;
  playoffTeams?: number;
  playoffFormat?: string;
  divisionWinnersQualify?: boolean;
}) {
  return {
    id: doc._id,
    name: doc.name,
    leagueId: doc.leagueId,
    startDate: doc.startDate ?? null,
    endDate: doc.endDate ?? null,
    status: doc.status,
    rosterLocked: doc.rosterLocked ?? false,
    playoffTeams: doc.playoffTeams ?? null,
    playoffFormat: doc.playoffFormat ?? null,
    divisionWinnersQualify: doc.divisionWinnersQualify ?? false,
  };
}

function toRosterAssignmentDto(doc: {
  _id: string;
  seasonId: string;
  teamId: string;
  playerId: string;
  leagueId: string;
  depthRank: number;
  positionSlot: string;
  status: string;
  assignedAt: string;
  assignedBy: string;
}) {
  return {
    id: doc._id,
    seasonId: doc.seasonId,
    teamId: doc.teamId,
    playerId: doc.playerId,
    leagueId: doc.leagueId,
    depthRank: doc.depthRank,
    positionSlot: doc.positionSlot,
    status: doc.status,
    assignedAt: doc.assignedAt,
    assignedBy: doc.assignedBy,
  };
}

const rosterAssignmentDtoValidator = v.object({
  id: v.string(),
  seasonId: v.string(),
  teamId: v.string(),
  playerId: v.string(),
  leagueId: v.string(),
  depthRank: v.number(),
  positionSlot: v.string(),
  status: v.string(),
  assignedAt: v.string(),
  assignedBy: v.string(),
});

function toRosterAuditLogDto(doc: {
  _id: string;
  leagueId: string;
  teamId: string;
  seasonId: string;
  actorUserId: string;
  action: string;
  beforeJson: string | null;
  afterJson: string | null;
  createdAt: string;
}) {
  return {
    id: doc._id,
    leagueId: doc.leagueId,
    teamId: doc.teamId,
    seasonId: doc.seasonId,
    actorUserId: doc.actorUserId,
    action: doc.action,
    beforeJson: doc.beforeJson ?? null,
    afterJson: doc.afterJson ?? null,
    createdAt: doc.createdAt,
  };
}

const rosterAuditLogDtoValidator = v.object({
  id: v.string(),
  leagueId: v.string(),
  teamId: v.string(),
  seasonId: v.string(),
  actorUserId: v.string(),
  action: v.string(),
  beforeJson: v.union(v.string(), v.null()),
  afterJson: v.union(v.string(), v.null()),
  createdAt: v.string(),
});

const ROSTER_STATUSES = ["active", "ir", "suspended", "released"] as const;

function assertValidRosterStatus(status: string): void {
  if (!ROSTER_STATUSES.includes(status as (typeof ROSTER_STATUSES)[number])) {
    throw new Error(`invalid_status:${status}`);
  }
}

export const getVisibleLeagueContext = queryGeneric({
  args: {
    orgIds: v.array(v.string()),
    userId: v.string(),
  },
  returns: v.object({
    visibleLeagueIds: v.array(v.string()),
    subscribedLeagueIds: v.array(v.string()),
    // À la carte scopes (WSM-000100): one entry per PARTIAL subscription
    // (teamIds set & non-empty). Full ("import all") subscriptions are omitted
    // so the consumer treats them as unrestricted.
    subscriptionScopes: v.array(
      v.object({
        leagueId: v.string(),
        teamIds: v.array(v.string()),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const subscriptionDocs = await ctx.db
      .query("leagueSubscriptions")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();

    const subscribedLeagueIds = subscriptionDocs.map((doc) => doc.leagueId);
    const subscriptionScopes = subscriptionDocs
      .filter((doc) => doc.teamIds && doc.teamIds.length > 0)
      .map((doc) => ({
        leagueId: doc.leagueId as string,
        teamIds: (doc.teamIds ?? []).map((id: string) => id),
      }));
    const orgLeagueDocs = await Promise.all(
      args.orgIds.map((orgId) =>
        ctx.db
          .query("leagues")
          .withIndex("by_orgId", (q) => q.eq("orgId", orgId))
          .collect(),
      ),
    );

    // Private-workspace model (WSM-000117): the dashboard shows ONLY the user's
    // org (workspace) leagues. Reference leagues are reached via Discover, not
    // a "follow" subscription — so subscriptions no longer grant visibility.
    // This also removes the dual-presence wart (a followed reference league and
    // its forked copy both appearing). subscribedLeagueIds is still returned for
    // back-compat but no longer feeds visibility.
    const visibleLeagueIds = Array.from(
      new Set(orgLeagueDocs.flat().map((league) => league._id)),
    );

    return {
      visibleLeagueIds,
      subscribedLeagueIds,
      subscriptionScopes,
    };
  },
});

/**
 * The set of reference team ids an org has already forked into its workspace
 * (WSM-000117). Lets Discover mark teams as "Added".
 */
export const getOrgForkedSourceTeamIds = queryGeneric({
  args: { orgId: v.string() },
  returns: v.array(v.string()),
  handler: async (ctx, args) => {
    const workspaceLeagues = await ctx.db
      .query("leagues")
      .withIndex("by_orgId", (q) => q.eq("orgId", args.orgId))
      .collect();
    const sourceTeamIds: string[] = [];
    for (const league of workspaceLeagues) {
      const teams = await ctx.db
        .query("teams")
        .withIndex("by_leagueId", (q) => q.eq("leagueId", league._id))
        .collect();
      for (const t of teams) {
        if (t.sourceTeamId) sourceTeamIds.push(t.sourceTeamId as string);
      }
    }
    return sourceTeamIds;
  },
});

export const listPublicLeagues = queryGeneric({
  args: {},
  returns: v.array(
    v.object({
      id: v.string(),
      name: v.string(),
      orgId: v.union(v.string(), v.null()),
    }),
  ),
  handler: async (ctx) => {
    const docs = await ctx.db
      .query("leagues")
      .withIndex("by_isPublic", (q) => q.eq("isPublic", true))
      .collect();
    return sortByName(docs.map(toLeagueDto));
  },
});

export const getLeagueByInviteToken = queryGeneric({
  args: { token: v.string() },
  returns: v.union(
    v.object({
      leagueId: v.string(),
      orgId: v.union(v.string(), v.null()),
      name: v.string(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const doc = await ctx.db
      .query("leagues")
      .withIndex("by_inviteToken", (q) => q.eq("inviteToken", args.token))
      .unique();

    if (!doc) return null;

    return {
      leagueId: doc._id,
      orgId: doc.orgId ?? null,
      name: doc.name,
    };
  },
});

// WSM-000199: invite links are per-league (the token lives on the league row),
// so this is keyed by leagueId. The old getLeagueForOrg used .unique() on
// by_orgId, which throws once an org owns 2+ leagues (workspace forks, claims).
export const getLeagueInviteInfo = queryGeneric({
  args: { leagueId: v.id("leagues") },
  returns: v.union(
    v.object({
      orgId: v.union(v.string(), v.null()),
      token: v.union(v.string(), v.null()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.leagueId);
    if (!doc) return null;
    return { orgId: doc.orgId ?? null, token: doc.inviteToken ?? null };
  },
});

export const getLeagueOrgId = queryGeneric({
  args: { leagueId: v.id("leagues") },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.leagueId);
    if (!doc) return null;
    return doc.orgId ?? null;
  },
});

export const listLeagues = queryGeneric({
  args: { leagueIds: v.array(v.id("leagues")) },
  returns: v.array(
    v.object({
      id: v.string(),
      name: v.string(),
      orgId: v.union(v.string(), v.null()),
    }),
  ),
  handler: async (ctx, args) => {
    const docs = await Promise.all(args.leagueIds.map((id) => ctx.db.get(id)));
    return sortByName(docs.filter(Boolean).map(toLeagueDto));
  },
});

export const getLeague = queryGeneric({
  args: { leagueId: v.id("leagues") },
  returns: v.union(
    v.object({
      id: v.string(),
      name: v.string(),
      orgId: v.union(v.string(), v.null()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.leagueId);
    return doc ? toLeagueDto(doc) : null;
  },
});

export const getLeagueByName = queryGeneric({
  args: { name: v.string() },
  returns: v.union(
    v.object({
      id: v.string(),
      name: v.string(),
      orgId: v.union(v.string(), v.null()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const doc = await ctx.db
      .query("leagues")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .unique();
    return doc ? toLeagueDto(doc) : null;
  },
});

export const listDivisions = queryGeneric({
  args: { leagueIds: v.array(v.id("leagues")) },
  returns: v.array(
    v.object({
      id: v.string(),
      name: v.string(),
      leagueId: v.string(),
      conferenceId: v.union(v.string(), v.null()),
    }),
  ),
  handler: async (ctx, args) => {
    const docs = await Promise.all(
      args.leagueIds.map((leagueId) =>
        ctx.db
          .query("divisions")
          .withIndex("by_leagueId", (q) => q.eq("leagueId", leagueId))
          .collect(),
      ),
    );
    return sortByName(uniqueById(docs.flat().map(toDivisionDto)));
  },
});

export const getDivision = queryGeneric({
  args: { divisionId: v.id("divisions") },
  returns: v.union(
    v.object({
      id: v.string(),
      name: v.string(),
      leagueId: v.string(),
      conferenceId: v.union(v.string(), v.null()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.divisionId);
    return doc ? toDivisionDto(doc) : null;
  },
});

/** Conferences for one or more leagues (WSM-000133). */
export const listConferences = queryGeneric({
  args: { leagueIds: v.array(v.id("leagues")) },
  returns: v.array(
    v.object({
      id: v.string(),
      name: v.string(),
      leagueId: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const docs = await Promise.all(
      args.leagueIds.map((leagueId) =>
        ctx.db
          .query("conferences")
          .withIndex("by_leagueId", (q) => q.eq("leagueId", leagueId))
          .collect(),
      ),
    );
    return sortByName(uniqueById(docs.flat().map(toConferenceDto)));
  },
});

export const listTeams = queryGeneric({
  args: { leagueIds: v.array(v.id("leagues")) },
  returns: v.array(
    v.object({
      id: v.string(),
      name: v.string(),
      leagueId: v.string(),
      city: v.string(),
      stadium: v.string(),
      foundedYear: v.union(v.number(), v.null()),
      location: v.string(),
      divisionId: v.string(),
      logoUrl: v.union(v.string(), v.null()),
      teamName: v.union(v.string(), v.null()),
      primaryColor: v.union(v.string(), v.null()),
      secondaryColor: v.union(v.string(), v.null()),
      allowDuplicateJerseys: v.boolean(),
      maxprepsSupplierId: v.union(v.string(), v.null()),
      rosterLimit: v.union(v.number(), v.null()),
    }),
  ),
  handler: async (ctx, args) => {
    const docs = await Promise.all(
      args.leagueIds.map((leagueId) =>
        ctx.db
          .query("teams")
          .withIndex("by_leagueId", (q) => q.eq("leagueId", leagueId))
          .collect(),
      ),
    );
    return sortByName(uniqueById(docs.flat().map(toTeamDto)));
  },
});

export const listTeamsByLeague = queryGeneric({
  args: { leagueId: v.id("leagues") },
  returns: v.array(
    v.object({
      id: v.string(),
      name: v.string(),
      leagueId: v.string(),
      city: v.string(),
      stadium: v.string(),
      foundedYear: v.union(v.number(), v.null()),
      location: v.string(),
      divisionId: v.string(),
      logoUrl: v.union(v.string(), v.null()),
      teamName: v.union(v.string(), v.null()),
      primaryColor: v.union(v.string(), v.null()),
      secondaryColor: v.union(v.string(), v.null()),
      allowDuplicateJerseys: v.boolean(),
      maxprepsSupplierId: v.union(v.string(), v.null()),
      rosterLimit: v.union(v.number(), v.null()),
    }),
  ),
  handler: async (ctx, args) => {
    const docs = await ctx.db
      .query("teams")
      .withIndex("by_leagueId", (q) => q.eq("leagueId", args.leagueId))
      .collect();
    return sortByName(docs.map(toTeamDto));
  },
});

export const getTeam = queryGeneric({
  args: { teamId: v.id("teams") },
  returns: v.union(
    v.object({
      id: v.string(),
      name: v.string(),
      leagueId: v.string(),
      city: v.string(),
      stadium: v.string(),
      foundedYear: v.union(v.number(), v.null()),
      location: v.string(),
      divisionId: v.string(),
      logoUrl: v.union(v.string(), v.null()),
      teamName: v.union(v.string(), v.null()),
      primaryColor: v.union(v.string(), v.null()),
      secondaryColor: v.union(v.string(), v.null()),
      allowDuplicateJerseys: v.boolean(),
      maxprepsSupplierId: v.union(v.string(), v.null()),
      rosterLimit: v.union(v.number(), v.null()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.teamId);
    return doc ? toTeamDto(doc) : null;
  },
});

export const getTeamLeagueId = queryGeneric({
  args: { teamId: v.id("teams") },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.teamId);
    return doc?.leagueId ?? null;
  },
});

/** Hybrid fork model (WSM-000109): the org that claimed this team, or null. */
export const getTeamOwnerOrgId = queryGeneric({
  args: { teamId: v.id("teams") },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.teamId);
    return doc?.ownerOrgId ?? null;
  },
});

export const listPlayers = queryGeneric({
  args: { leagueIds: v.array(v.id("leagues")) },
  returns: v.array(
    playerDtoValidator,
  ),
  handler: async (ctx, args) => {
    const docs = await Promise.all(
      args.leagueIds.map((leagueId) =>
        ctx.db
          .query("players")
          .withIndex("by_leagueId", (q) => q.eq("leagueId", leagueId))
          .collect(),
      ),
    );
    return sortByName(uniqueById(docs.flat().map(toPlayerDto)));
  },
});

export const listPlayersByTeam = queryGeneric({
  args: { teamId: v.id("teams") },
  returns: v.array(
    playerDtoValidator,
  ),
  handler: async (ctx, args) => {
    const docs = await ctx.db
      .query("players")
      .withIndex("by_teamId", (q) => q.eq("teamId", args.teamId))
      .collect();
    return sortByName(docs.map(toPlayerDto));
  },
});

export const getPlayer = queryGeneric({
  args: { playerId: v.id("players") },
  returns: v.union(
    playerDtoValidator,
    v.null(),
  ),
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.playerId);
    return doc ? toPlayerDto(doc) : null;
  },
});

export const listSeasons = queryGeneric({
  args: { leagueIds: v.array(v.id("leagues")) },
  returns: v.array(
    v.object({
      id: v.string(),
      name: v.string(),
      leagueId: v.string(),
      startDate: v.union(v.string(), v.null()),
      endDate: v.union(v.string(), v.null()),
      status: v.string(),
      rosterLocked: v.boolean(),
      playoffTeams: v.optional(v.union(v.number(), v.null())),
      playoffFormat: v.optional(v.union(v.string(), v.null())),
      divisionWinnersQualify: v.optional(v.boolean()),
    }),
  ),
  handler: async (ctx, args) => {
    const docs = await Promise.all(
      args.leagueIds.map((leagueId) =>
        ctx.db
          .query("seasons")
          .withIndex("by_leagueId", (q) => q.eq("leagueId", leagueId))
          .collect(),
      ),
    );
    return sortByName(uniqueById(docs.flat().map(toSeasonDto)));
  },
});

export const getSeason = queryGeneric({
  args: { seasonId: v.id("seasons") },
  returns: v.union(
    v.object({
      id: v.string(),
      name: v.string(),
      leagueId: v.string(),
      startDate: v.union(v.string(), v.null()),
      endDate: v.union(v.string(), v.null()),
      status: v.string(),
      rosterLocked: v.boolean(),
      playoffTeams: v.optional(v.union(v.number(), v.null())),
      playoffFormat: v.optional(v.union(v.string(), v.null())),
      divisionWinnersQualify: v.optional(v.boolean()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.seasonId);
    return doc ? toSeasonDto(doc) : null;
  },
});

export const getSyncConfig = queryGeneric({
  args: {},
  returns: v.object({
    syncEnabled: v.boolean(),
    lastSyncReportJson: v.union(v.string(), v.null()),
  }),
  handler: async (ctx) => {
    const doc = await ctx.db
      .query("syncConfigs")
      .withIndex("by_key", (q) => q.eq("key", "nfl"))
      .unique();

    return {
      syncEnabled: doc?.syncEnabled ?? false,
      lastSyncReportJson: doc?.lastSyncReportJson ?? null,
    };
  },
});

export const healthSummary = queryGeneric({
  args: {},
  returns: v.object({
    leagues: v.number(),
    divisions: v.number(),
    teams: v.number(),
    players: v.number(),
    seasons: v.number(),
  }),
  handler: async (ctx) => {
    const [leagues, divisions, teams, players, seasons] = await Promise.all([
      ctx.db.query("leagues").collect(),
      ctx.db.query("divisions").collect(),
      ctx.db.query("teams").collect(),
      ctx.db.query("players").collect(),
      ctx.db.query("seasons").collect(),
    ]);
    return {
      leagues: leagues.length,
      divisions: divisions.length,
      teams: teams.length,
      players: players.length,
      seasons: seasons.length,
    };
  },
});

export const upsertLeague = internalMutationGeneric({
  args: {
    name: v.string(),
    orgId: v.union(v.string(), v.null()),
  },
  returns: v.object({
    dto: v.object({
      id: v.string(),
      name: v.string(),
      orgId: v.union(v.string(), v.null()),
    }),
    created: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("leagues")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .unique();

    if (existing) {
      return { dto: toLeagueDto(existing), created: false };
    }

    const leagueId = await ctx.db.insert("leagues", {
      name: args.name,
      orgId: args.orgId,
      isPublic: args.orgId === null,
      inviteToken: null,
    });

    return {
      dto: {
        id: leagueId,
        name: args.name,
        orgId: args.orgId,
      },
      created: true,
    };
  },
});

/** Create a new org-owned league (WSM-000118). Name unique within the org. */
export const createLeague = internalMutationGeneric({
  args: { name: v.string(), orgId: v.string() },
  returns: v.object({ id: v.string(), name: v.string() }),
  handler: async (ctx, args) => {
    const name = args.name.trim();
    if (!name) throw new Error("League name is required");
    const dupe = (
      await ctx.db
        .query("leagues")
        .withIndex("by_orgId", (q) => q.eq("orgId", args.orgId))
        .collect()
    ).some((l) => l.name === name);
    if (dupe) throw new Error("You already have a league with that name");
    const id = await ctx.db.insert("leagues", {
      name,
      orgId: args.orgId,
      isPublic: false,
      inviteToken: null,
    });
    return { id: id as string, name };
  },
});

/** Rename a league (WSM-000118). Auth enforced in the calling server action. */
export const renameLeague = internalMutationGeneric({
  args: { leagueId: v.id("leagues"), name: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const name = args.name.trim();
    if (!name) throw new Error("League name is required");
    const league = await ctx.db.get(args.leagueId);
    if (!league) throw new Error("league_not_found");
    await ctx.db.patch(args.leagueId, { name });
    return null;
  },
});

/**
 * Delete a league and everything under it (WSM-000118): subscriptions, audit
 * log, roster assignments, seasons + fixtures + game results + player
 * attributes, depth-chart entries, players, teams, divisions. Auth enforced in
 * the calling server action (org:admin of the league's org).
 */
/*
 * Delete a league in bounded batches (WSM-000122). A forked NFL league carries
 * ~2,900 players plus their attributes/ratings/assignments — far more than a
 * single Convex mutation can read/write in one transaction. So each call purges
 * up to `maxTeams` teams (each via the bounded `purgeTeam` cascade) and reports
 * whether more remain; once no teams are left it sweeps the league-level rows
 * (subscriptions, seasons + their fixtures/results/attributes, divisions, audit
 * log, assignments) and deletes the league itself. The caller loops until
 * `done`. Idempotent and resumable — a partial delete just continues next call.
 */
export const deleteLeagueBatch = internalMutationGeneric({
  args: { leagueId: v.id("leagues"), maxTeams: v.optional(v.number()) },
  returns: v.object({ done: v.boolean(), teamsDeleted: v.number() }),
  handler: async (ctx, args) => {
    const league = await ctx.db.get(args.leagueId);
    if (!league) return { done: true, teamsDeleted: 0 };

    const limit = Math.max(1, Math.min(args.maxTeams ?? 3, 25));
    const teams = await ctx.db
      .query("teams")
      .withIndex("by_leagueId", (q) => q.eq("leagueId", args.leagueId))
      .take(limit);

    // Still have teams: purge this batch and ask the caller to come back.
    if (teams.length > 0) {
      for (const team of teams) await purgeTeam(ctx as MutationCtx, team._id);
      return { done: false, teamsDeleted: teams.length };
    }

    // No teams left — sweep the (now small) league-level rows and the league.
    for (const s of await ctx.db
      .query("leagueSubscriptions")
      .withIndex("by_leagueId", (q) => q.eq("leagueId", args.leagueId))
      .collect())
      await ctx.db.delete(s._id);
    for (const a of await ctx.db
      .query("rosterAuditLog")
      .withIndex("by_leagueId_createdAt", (q) => q.eq("leagueId", args.leagueId))
      .collect())
      await ctx.db.delete(a._id);
    for (const r of await ctx.db
      .query("rosterAssignments")
      .withIndex("by_leagueId_seasonId", (q) => q.eq("leagueId", args.leagueId))
      .collect())
      await ctx.db.delete(r._id);

    const seasons = await ctx.db
      .query("seasons")
      .withIndex("by_leagueId", (q) => q.eq("leagueId", args.leagueId))
      .collect();
    for (const season of seasons) {
      const fixtures = await ctx.db
        .query("fixtures")
        .withIndex("by_seasonId", (q) => q.eq("seasonId", season._id))
        .collect();
      for (const f of fixtures) {
        for (const gr of await ctx.db
          .query("gameResults")
          .withIndex("by_fixtureId", (q) => q.eq("fixtureId", f._id))
          .collect())
          await ctx.db.delete(gr._id);
        await ctx.db.delete(f._id);
      }
      for (const pa of await ctx.db
        .query("playerAttributes")
        .withIndex("by_seasonId_positionGroup", (q) =>
          q.eq("seasonId", season._id),
        )
        .collect())
        await ctx.db.delete(pa._id);
      await ctx.db.delete(season._id);
    }

    for (const d of await ctx.db
      .query("divisions")
      .withIndex("by_leagueId", (q) => q.eq("leagueId", args.leagueId))
      .collect())
      await ctx.db.delete(d._id);

    await ctx.db.delete(args.leagueId);
    return { done: true, teamsDeleted: 0 };
  },
});

/*
 * @deprecated Single-shot league delete kept for deploy-order compatibility
 * (the previously-shipped web calls `sports:deleteLeague`). New web loops
 * `deleteLeagueBatch` instead, which is safe for large forked leagues. Remove
 * this once the WSM-000122 web release is live everywhere. Fine for small
 * leagues; a very large one can exceed mutation limits — exactly why the
 * batched path exists.
 */
export const deleteLeague = internalMutationGeneric({
  args: { leagueId: v.id("leagues") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const league = await ctx.db.get(args.leagueId);
    if (!league) return null;

    const teams = await ctx.db
      .query("teams")
      .withIndex("by_leagueId", (q) => q.eq("leagueId", args.leagueId))
      .collect();
    for (const team of teams) await purgeTeam(ctx as MutationCtx, team._id);

    for (const s of await ctx.db
      .query("leagueSubscriptions")
      .withIndex("by_leagueId", (q) => q.eq("leagueId", args.leagueId))
      .collect())
      await ctx.db.delete(s._id);
    for (const a of await ctx.db
      .query("rosterAuditLog")
      .withIndex("by_leagueId_createdAt", (q) => q.eq("leagueId", args.leagueId))
      .collect())
      await ctx.db.delete(a._id);
    for (const r of await ctx.db
      .query("rosterAssignments")
      .withIndex("by_leagueId_seasonId", (q) => q.eq("leagueId", args.leagueId))
      .collect())
      await ctx.db.delete(r._id);

    const seasons = await ctx.db
      .query("seasons")
      .withIndex("by_leagueId", (q) => q.eq("leagueId", args.leagueId))
      .collect();
    for (const season of seasons) {
      const fixtures = await ctx.db
        .query("fixtures")
        .withIndex("by_seasonId", (q) => q.eq("seasonId", season._id))
        .collect();
      for (const f of fixtures) {
        for (const gr of await ctx.db
          .query("gameResults")
          .withIndex("by_fixtureId", (q) => q.eq("fixtureId", f._id))
          .collect())
          await ctx.db.delete(gr._id);
        await ctx.db.delete(f._id);
      }
      for (const pa of await ctx.db
        .query("playerAttributes")
        .withIndex("by_seasonId_positionGroup", (q) =>
          q.eq("seasonId", season._id),
        )
        .collect())
        await ctx.db.delete(pa._id);
      await ctx.db.delete(season._id);
    }

    for (const d of await ctx.db
      .query("divisions")
      .withIndex("by_leagueId", (q) => q.eq("leagueId", args.leagueId))
      .collect())
      await ctx.db.delete(d._id);

    await ctx.db.delete(args.leagueId);
    return null;
  },
});

export const upsertDivision = internalMutationGeneric({
  args: {
    name: v.string(),
    leagueId: v.id("leagues"),
    conferenceId: v.optional(v.id("conferences")),
  },
  returns: v.object({
    dto: v.object({
      id: v.string(),
      name: v.string(),
      leagueId: v.string(),
      conferenceId: v.union(v.string(), v.null()),
    }),
    created: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const existing =
      (
        await ctx.db
          .query("divisions")
          .withIndex("by_leagueId", (q) => q.eq("leagueId", args.leagueId))
          .collect()
      ).find((division) => division.name === args.name) ?? null;

    if (existing) {
      return { dto: toDivisionDto(existing), created: false };
    }

    const divisionId = await ctx.db.insert("divisions", {
      name: args.name,
      leagueId: args.leagueId,
      ...(args.conferenceId ? { conferenceId: args.conferenceId } : {}),
    });
    return {
      dto: {
        id: divisionId,
        name: args.name,
        leagueId: args.leagueId,
        conferenceId: args.conferenceId ?? null,
      },
      created: true,
    };
  },
});

/** Rename a division by id (WSM-000132 / WSM-000128). */
export const updateDivision = internalMutationGeneric({
  args: { divisionId: v.id("divisions"), name: v.string() },
  returns: v.union(
    v.object({
      id: v.string(),
      name: v.string(),
      leagueId: v.string(),
      conferenceId: v.union(v.string(), v.null()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.divisionId);
    if (!existing) return null;
    await ctx.db.patch(args.divisionId, { name: args.name });
    return toDivisionDto({ ...existing, name: args.name });
  },
});

/**
 * Delete an empty division (WSM-000132 / WSM-000128). Refuses when teams still
 * reference it — they must be moved or removed first — so no team is orphaned.
 */
export const deleteDivision = internalMutationGeneric({
  args: { divisionId: v.id("divisions") },
  // `teamCount` is the number of teams reassigned to "no division" (WSM-000128).
  returns: v.object({ ok: v.boolean(), teamCount: v.number() }),
  handler: async (ctx, args) => {
    const teams = await ctx.db
      .query("teams")
      .withIndex("by_divisionId", (q) => q.eq("divisionId", args.divisionId))
      .collect();
    // Reassign teams to "no division" rather than orphaning or deleting them,
    // then drop the division.
    for (const team of teams) {
      await ctx.db.patch(team._id, { divisionId: null });
    }
    await ctx.db.delete(args.divisionId);
    return { ok: true, teamCount: teams.length };
  },
});

export const upsertTeam = internalMutationGeneric({
  args: {
    name: v.string(),
    city: v.string(),
    stadium: v.string(),
    leagueId: v.id("leagues"),
    divisionId: v.union(v.id("divisions"), v.null()),
    logoUrl: v.union(v.string(), v.null()),
  },
  returns: v.object({
    dto: v.object({
      id: v.string(),
      name: v.string(),
      leagueId: v.string(),
      city: v.string(),
      stadium: v.string(),
      foundedYear: v.union(v.number(), v.null()),
      location: v.string(),
      divisionId: v.string(),
      logoUrl: v.union(v.string(), v.null()),
      teamName: v.union(v.string(), v.null()),
      primaryColor: v.union(v.string(), v.null()),
      secondaryColor: v.union(v.string(), v.null()),
      allowDuplicateJerseys: v.boolean(),
      maxprepsSupplierId: v.union(v.string(), v.null()),
      rosterLimit: v.union(v.number(), v.null()),
    }),
    created: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const existing =
      (
        await ctx.db
          .query("teams")
          .withIndex("by_leagueId", (q) => q.eq("leagueId", args.leagueId))
          .collect()
      ).find((team) => team.name === args.name) ?? null;

    if (existing) {
      await ctx.db.patch(existing._id, {
        city: args.city,
        stadium: args.stadium,
        location: args.city,
        divisionId: args.divisionId,
        logoUrl: args.logoUrl,
      });
      return {
        dto: toTeamDto({
          ...existing,
          city: args.city,
          stadium: args.stadium,
          location: args.city,
          divisionId: args.divisionId,
          logoUrl: args.logoUrl,
        }),
        created: false,
      };
    }

    const teamId = await ctx.db.insert("teams", {
      name: args.name,
      leagueId: args.leagueId,
      divisionId: args.divisionId,
      city: args.city,
      stadium: args.stadium,
      foundedYear: null,
      location: args.city,
      logoUrl: args.logoUrl,
      rosterLimit: 53,
    });

    return {
      dto: {
        id: teamId,
        name: args.name,
        leagueId: args.leagueId,
        city: args.city,
        stadium: args.stadium,
        foundedYear: null,
        location: args.city,
        divisionId: args.divisionId ?? "",
        logoUrl: args.logoUrl,
        rosterLimit: 53,
        teamName: null,
        primaryColor: null,
        secondaryColor: null,
        allowDuplicateJerseys: true,
        maxprepsSupplierId: null,
      },
      created: true,
    };
  },
});

export const upsertPlayer = internalMutationGeneric({
  args: {
    name: v.string(),
    leagueId: v.id("leagues"),
    teamId: v.id("teams"),
    position: v.string(),
    jerseyNumber: v.union(v.number(), v.null()),
    dateOfBirth: v.union(v.string(), v.null()),
    status: v.string(),
    headshotUrl: v.union(v.string(), v.null()),
    experienceYears: v.optional(v.union(v.number(), v.null())),
    grade: v.optional(v.union(v.number(), v.null())),
    squad: v.optional(v.union(v.string(), v.null())),
    hometown: v.optional(v.union(v.string(), v.null())),
  },
  returns: v.object({
    dto: playerDtoValidator,
    created: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const existing =
      (
        await ctx.db
          .query("players")
          .withIndex("by_teamId", (q) => q.eq("teamId", args.teamId))
          .collect()
      ).find((player) => player.name === args.name) ?? null;

    if (existing) {
      await ctx.db.patch(existing._id, {
        leagueId: args.leagueId,
        position: args.position,
        jerseyNumber: args.jerseyNumber,
        dateOfBirth: args.dateOfBirth,
        status: args.status,
        headshotUrl: args.headshotUrl,
        experienceYears: args.experienceYears ?? null,
        grade: args.grade ?? null,
        squad: args.squad ?? null,
        hometown: args.hometown ?? existing.hometown ?? null,
      });
      return {
        dto: toPlayerDto({
          ...existing,
          leagueId: args.leagueId,
          position: args.position,
          jerseyNumber: args.jerseyNumber,
          dateOfBirth: args.dateOfBirth,
          status: args.status,
          headshotUrl: args.headshotUrl,
          experienceYears: args.experienceYears ?? null,
          grade: args.grade ?? null,
          squad: args.squad ?? null,
          hometown: args.hometown ?? existing.hometown ?? null,
        }),
        created: false,
      };
    }

    const playerId = await ctx.db.insert("players", {
      ...args,
      positionGroup: null,
    });
    return {
      dto: {
        id: playerId,
        name: args.name,
        teamId: args.teamId,
        position: args.position,
        positionGroup: null,
        jerseyNumber: args.jerseyNumber,
        dateOfBirth: args.dateOfBirth,
        status: args.status,
        headshotUrl: args.headshotUrl,
        experienceYears: args.experienceYears ?? null,
        grade: args.grade ?? null,
        squad: args.squad ?? null,
        hometown: args.hometown ?? null,
      },
      created: true,
    };
  },
});

export const createTeam = internalMutationGeneric({
  args: {
    name: v.string(),
    leagueId: v.id("leagues"),
    city: v.string(),
    stadium: v.string(),
  },
  returns: v.object({
    id: v.string(),
    name: v.string(),
    leagueId: v.string(),
    city: v.string(),
    stadium: v.string(),
    foundedYear: v.union(v.number(), v.null()),
    location: v.string(),
    divisionId: v.string(),
    logoUrl: v.union(v.string(), v.null()),
    teamName: v.union(v.string(), v.null()),
    primaryColor: v.union(v.string(), v.null()),
    secondaryColor: v.union(v.string(), v.null()),
    allowDuplicateJerseys: v.boolean(),
    maxprepsSupplierId: v.union(v.string(), v.null()),
    rosterLimit: v.union(v.number(), v.null()),
  }),
  handler: async (ctx, args) => {
    const teamId = await ctx.db.insert("teams", {
      name: args.name,
      leagueId: args.leagueId,
      divisionId: null,
      city: args.city,
      stadium: args.stadium,
      foundedYear: null,
      location: args.city,
      logoUrl: null,
      rosterLimit: 53,
    });
    return {
      id: teamId,
      name: args.name,
      leagueId: args.leagueId,
      city: args.city,
      stadium: args.stadium,
      foundedYear: null,
      location: args.city,
      divisionId: "",
      logoUrl: null,
      rosterLimit: 53,
      teamName: null,
      primaryColor: null,
      secondaryColor: null,
      allowDuplicateJerseys: true,
      maxprepsSupplierId: null,
    };
  },
});

export const updateTeam = internalMutationGeneric({
  args: {
    teamId: v.id("teams"),
    name: v.optional(v.string()),
    city: v.optional(v.string()),
    stadium: v.optional(v.string()),
    foundedYear: v.optional(v.union(v.number(), v.null())),
    location: v.optional(v.string()),
    divisionId: v.optional(v.id("divisions")),
    teamName: v.optional(v.union(v.string(), v.null())),
    logoUrl: v.optional(v.union(v.string(), v.null())),
    primaryColor: v.optional(v.union(v.string(), v.null())),
    secondaryColor: v.optional(v.union(v.string(), v.null())),
    allowDuplicateJerseys: v.optional(v.boolean()),
    maxprepsSupplierId: v.optional(v.union(v.string(), v.null())),
  },
  returns: v.union(
    v.object({
      id: v.string(),
      name: v.string(),
      leagueId: v.string(),
      city: v.string(),
      stadium: v.string(),
      foundedYear: v.union(v.number(), v.null()),
      location: v.string(),
      divisionId: v.string(),
      logoUrl: v.union(v.string(), v.null()),
      teamName: v.union(v.string(), v.null()),
      primaryColor: v.union(v.string(), v.null()),
      secondaryColor: v.union(v.string(), v.null()),
      allowDuplicateJerseys: v.boolean(),
      maxprepsSupplierId: v.union(v.string(), v.null()),
      rosterLimit: v.union(v.number(), v.null()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.teamId);
    if (!existing) return null;

    const patch = {
      ...(args.name !== undefined ? { name: args.name } : {}),
      ...(args.city !== undefined ? { city: args.city } : {}),
      ...(args.stadium !== undefined ? { stadium: args.stadium } : {}),
      ...(args.foundedYear !== undefined ? { foundedYear: args.foundedYear } : {}),
      ...(args.location !== undefined ? { location: args.location } : {}),
      ...(args.divisionId !== undefined ? { divisionId: args.divisionId } : {}),
      ...(args.teamName !== undefined ? { teamName: args.teamName } : {}),
      ...(args.logoUrl !== undefined ? { logoUrl: args.logoUrl } : {}),
      ...(args.primaryColor !== undefined
        ? { primaryColor: args.primaryColor }
        : {}),
      ...(args.secondaryColor !== undefined
        ? { secondaryColor: args.secondaryColor }
        : {}),
      ...(args.allowDuplicateJerseys !== undefined
        ? { allowDuplicateJerseys: args.allowDuplicateJerseys }
        : {}),
      ...(args.maxprepsSupplierId !== undefined
        ? { maxprepsSupplierId: args.maxprepsSupplierId }
        : {}),
    };
    await ctx.db.patch(args.teamId, patch);

    return toTeamDto({
      ...existing,
      ...patch,
    });
  },
});

/*
 * Jersey policy enforcement (WSM-000125). When a team's `allowDuplicateJerseys`
 * is false (it defaults to true / undefined), the player create/update mutations
 * reject a jersey number already worn by another ACTIVE player on the same team.
 * Returns true if the number is taken (and should be blocked). A null jersey is
 * never a conflict. `excludePlayerId` skips the player being edited.
 */
async function jerseyNumberTakenOnTeam(
  ctx: MutationCtx,
  teamId: Id<"teams">,
  jerseyNumber: number | null,
  excludePlayerId?: Id<"players">,
): Promise<boolean> {
  if (jerseyNumber === null) return false;
  const roster = await ctx.db
    .query("players")
    .withIndex("by_teamId", (q) => q.eq("teamId", teamId))
    .collect();
  return roster.some(
    (p) =>
      p._id !== excludePlayerId &&
      p.jerseyNumber === jerseyNumber &&
      p.status.toLowerCase() === "active",
  );
}

export const createPlayer = internalMutationGeneric({
  args: {
    name: v.string(),
    teamId: v.id("teams"),
    position: v.string(),
    jerseyNumber: v.union(v.number(), v.null()),
    dateOfBirth: v.union(v.string(), v.null()),
    status: v.string(),
    grade: v.optional(v.union(v.number(), v.null())),
    squad: v.optional(v.union(v.string(), v.null())),
    hometown: v.optional(v.union(v.string(), v.null())),
  },
  returns: v.object({
    id: v.string(),
    name: v.string(),
    teamId: v.string(),
    position: v.string(),
    positionGroup: v.union(v.string(), v.null()),
    jerseyNumber: v.union(v.number(), v.null()),
    dateOfBirth: v.union(v.string(), v.null()),
    status: v.string(),
    headshotUrl: v.union(v.string(), v.null()),
    experienceYears: v.optional(v.union(v.number(), v.null())),
    grade: v.union(v.number(), v.null()),
    squad: v.union(v.string(), v.null()),
    hometown: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    const team = await ctx.db.get(args.teamId);
    if (!team) {
      throw new Error("Team not found");
    }

    const allowDuplicates = team.allowDuplicateJerseys ?? true;
    if (
      !allowDuplicates &&
      (await jerseyNumberTakenOnTeam(
        ctx as MutationCtx,
        args.teamId,
        args.jerseyNumber,
      ))
    ) {
      throw new Error(`duplicate_jersey:${args.jerseyNumber}`);
    }

    const playerId = await ctx.db.insert("players", {
      ...args,
      leagueId: team.leagueId,
      headshotUrl: null,
      experienceYears: null,
      positionGroup: null,
    });

    return {
      id: playerId,
      name: args.name,
      teamId: args.teamId,
      position: args.position,
      positionGroup: null,
      jerseyNumber: args.jerseyNumber,
      dateOfBirth: args.dateOfBirth,
      status: args.status,
      headshotUrl: null,
      experienceYears: null,
      grade: args.grade ?? null,
      squad: args.squad ?? null,
      hometown: args.hometown ?? null,
    };
  },
});

// Bulk-insert synthetic players for a team (WSM-000173). Thin insert loop —
// the realistic data is generated in the web layer (lib/synthetic-roster) and
// passed in; this just persists. Mirrors createPlayer's insert shape.
export const bulkCreatePlayers = internalMutationGeneric({
  args: {
    teamId: v.id("teams"),
    players: v.array(
      v.object({
        name: v.string(),
        position: v.string(),
        jerseyNumber: v.union(v.number(), v.null()),
        status: v.string(),
        grade: v.optional(v.union(v.number(), v.null())),
        squad: v.optional(v.union(v.string(), v.null())),
        dateOfBirth: v.optional(v.union(v.string(), v.null())),
        hometown: v.optional(v.union(v.string(), v.null())),
      }),
    ),
  },
  returns: v.object({ created: v.number() }),
  handler: async (ctx, args) => {
    const team = await ctx.db.get(args.teamId);
    if (!team) {
      throw new Error("Team not found");
    }
    let created = 0;
    for (const p of args.players) {
      await ctx.db.insert("players", {
        name: p.name,
        leagueId: team.leagueId,
        teamId: args.teamId,
        position: p.position,
        positionGroup: null,
        jerseyNumber: p.jerseyNumber,
        dateOfBirth: p.dateOfBirth ?? null,
        status: p.status,
        headshotUrl: null,
        experienceYears: null,
        grade: p.grade ?? null,
        squad: p.squad ?? null,
        hometown: p.hometown ?? null,
        synthetic: true,
      });
      created += 1;
    }
    return { created };
  },
});

// Delete the synthetic (generator-created) players on a team (WSM-000173).
// Only rows flagged `synthetic` are removed — real players are never touched.
export const clearSyntheticPlayers = internalMutationGeneric({
  args: { teamId: v.id("teams") },
  returns: v.object({ deleted: v.number() }),
  handler: async (ctx, args) => {
    const players = await ctx.db
      .query("players")
      .withIndex("by_teamId", (q) => q.eq("teamId", args.teamId))
      .collect();
    let deleted = 0;
    for (const p of players) {
      if (p.synthetic === true) {
        await ctx.db.delete(p._id);
        deleted += 1;
      }
    }
    return { deleted };
  },
});

export const updatePlayer = internalMutationGeneric({
  args: {
    playerId: v.id("players"),
    name: v.optional(v.string()),
    teamId: v.optional(v.id("teams")),
    position: v.optional(v.string()),
    jerseyNumber: v.optional(v.union(v.number(), v.null())),
    dateOfBirth: v.optional(v.union(v.string(), v.null())),
    status: v.optional(v.string()),
    grade: v.optional(v.union(v.number(), v.null())),
    squad: v.optional(v.union(v.string(), v.null())),
    hometown: v.optional(v.union(v.string(), v.null())),
  },
  returns: v.union(
    playerDtoValidator,
    v.null(),
  ),
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.playerId);
    if (!existing) return null;

    let leagueId = existing.leagueId;
    const targetTeamId = args.teamId ?? existing.teamId;
    const targetTeam = await ctx.db.get(targetTeamId);
    if (args.teamId !== undefined) {
      if (!targetTeam) {
        throw new Error("Team not found");
      }
      leagueId = targetTeam.leagueId;
    }

    // Jersey policy (WSM-000125): re-check on any jersey or team change.
    if (
      (args.jerseyNumber !== undefined || args.teamId !== undefined) &&
      targetTeam &&
      !(targetTeam.allowDuplicateJerseys ?? true)
    ) {
      const targetJersey =
        args.jerseyNumber !== undefined
          ? args.jerseyNumber
          : existing.jerseyNumber;
      if (
        await jerseyNumberTakenOnTeam(
          ctx as MutationCtx,
          targetTeamId,
          targetJersey,
          existing._id,
        )
      ) {
        throw new Error(`duplicate_jersey:${targetJersey}`);
      }
    }

    const patch = {
      ...(args.name !== undefined ? { name: args.name } : {}),
      ...(args.teamId !== undefined ? { teamId: args.teamId } : {}),
      ...(args.position !== undefined ? { position: args.position } : {}),
      ...(args.jerseyNumber !== undefined ? { jerseyNumber: args.jerseyNumber } : {}),
      ...(args.dateOfBirth !== undefined ? { dateOfBirth: args.dateOfBirth } : {}),
      ...(args.status !== undefined ? { status: args.status } : {}),
      ...(args.grade !== undefined ? { grade: args.grade } : {}),
      ...(args.squad !== undefined ? { squad: args.squad } : {}),
      ...(args.hometown !== undefined ? { hometown: args.hometown } : {}),
      ...(args.teamId !== undefined ? { leagueId } : {}),
    };

    await ctx.db.patch(args.playerId, patch);
    return toPlayerDto({
      ...existing,
      ...patch,
    });
  },
});

export const deletePlayer = internalMutationGeneric({
  args: { playerId: v.id("players") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.delete(args.playerId);
    return null;
  },
});

/*
 * Remove a single team from a league (WSM-000120). Cascades every row that
 * references the team so no orphans survive:
 *   players → their playerAttributes / maddenRatings / rosterAssignments
 *   depthChartEntries (all seasons) · rosterAuditLog
 *   fixtures (home or away) → their gameResults
 * Scoped to one team, so it stays comfortably inside mutation limits (unlike a
 * whole forked-NFL league delete). Idempotent: a missing team is a no-op.
 */
/*
 * Cascade-delete one team and everything that references it: players (and
 * their playerAttributes / maddenRatings / rosterAssignments), depth-chart
 * entries across all seasons, roster audit log, and fixtures (home or away)
 * with their gameResults. One team is bounded (~a roster's worth of rows), so
 * this stays well inside Convex mutation limits — which is why whole-league
 * deletion batches over teams rather than purging everything in one shot.
 * Idempotent: a missing team is a no-op.
 */
async function purgeTeam(ctx: MutationCtx, teamId: Id<"teams">): Promise<void> {
  const team = await ctx.db.get(teamId);
  if (!team) return;

  const players = await ctx.db
    .query("players")
    .withIndex("by_teamId", (q) => q.eq("teamId", teamId))
    .collect();
  for (const player of players) {
    const attributes = await ctx.db
      .query("playerAttributes")
      .withIndex("by_playerId_seasonId", (q) => q.eq("playerId", player._id))
      .collect();
    for (const row of attributes) await ctx.db.delete(row._id);

    const madden = await ctx.db
      .query("maddenRatings")
      .withIndex("by_playerId", (q) => q.eq("playerId", player._id))
      .collect();
    for (const row of madden) await ctx.db.delete(row._id);

    const assignments = await ctx.db
      .query("rosterAssignments")
      .withIndex("by_playerId", (q) => q.eq("playerId", player._id))
      .collect();
    for (const row of assignments) await ctx.db.delete(row._id);

    await ctx.db.delete(player._id);
  }

  const depthEntries = await ctx.db
    .query("depthChartEntries")
    .withIndex("by_team_season", (q) => q.eq("teamId", teamId))
    .collect();
  for (const row of depthEntries) await ctx.db.delete(row._id);

  const auditRows = await ctx.db
    .query("rosterAuditLog")
    .withIndex("by_teamId_createdAt", (q) => q.eq("teamId", teamId))
    .collect();
  for (const row of auditRows) await ctx.db.delete(row._id);

  const homeFixtures = await ctx.db
    .query("fixtures")
    .withIndex("by_homeTeamId", (q) => q.eq("homeTeamId", teamId))
    .collect();
  const awayFixtures = await ctx.db
    .query("fixtures")
    .withIndex("by_awayTeamId", (q) => q.eq("awayTeamId", teamId))
    .collect();
  for (const fixture of [...homeFixtures, ...awayFixtures]) {
    const results = await ctx.db
      .query("gameResults")
      .withIndex("by_fixtureId", (q) => q.eq("fixtureId", fixture._id))
      .collect();
    for (const row of results) await ctx.db.delete(row._id);
    await ctx.db.delete(fixture._id);
  }

  await ctx.db.delete(teamId);
}

export const deleteTeam = internalMutationGeneric({
  args: { teamId: v.id("teams") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await purgeTeam(ctx as MutationCtx, args.teamId);
    return null;
  },
});

export const upsertSeason = internalMutationGeneric({
  args: {
    name: v.string(),
    leagueId: v.id("leagues"),
    startDate: v.union(v.string(), v.null()),
    endDate: v.union(v.string(), v.null()),
    status: v.string(),
    playoffTeams: v.optional(v.number()),
    playoffFormat: v.optional(v.string()),
    divisionWinnersQualify: v.optional(v.boolean()),
  },
  returns: v.object({
    dto: v.object({
      id: v.string(),
      name: v.string(),
      leagueId: v.string(),
      startDate: v.union(v.string(), v.null()),
      endDate: v.union(v.string(), v.null()),
      status: v.string(),
      rosterLocked: v.boolean(),
      playoffTeams: v.optional(v.union(v.number(), v.null())),
      playoffFormat: v.optional(v.union(v.string(), v.null())),
      divisionWinnersQualify: v.optional(v.boolean()),
    }),
    created: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const existing =
      (
        await ctx.db
          .query("seasons")
          .withIndex("by_leagueId", (q) => q.eq("leagueId", args.leagueId))
          .collect()
      ).find((season) => season.name === args.name) ?? null;

    if (existing) {
      // Only overwrite playoff config when the caller actually supplied it, so
      // non-config callers (e.g. bulk import) don't wipe a season's settings.
      const patch: Record<string, unknown> = {
        startDate: args.startDate,
        endDate: args.endDate,
        status: args.status,
      };
      if (args.playoffTeams !== undefined) patch.playoffTeams = args.playoffTeams;
      if (args.playoffFormat !== undefined) patch.playoffFormat = args.playoffFormat;
      if (args.divisionWinnersQualify !== undefined) {
        patch.divisionWinnersQualify = args.divisionWinnersQualify;
      }
      await ctx.db.patch(existing._id, patch);
      return {
        dto: toSeasonDto({
          ...existing,
          startDate: args.startDate,
          endDate: args.endDate,
          status: args.status,
          playoffTeams: args.playoffTeams ?? existing.playoffTeams,
          playoffFormat: args.playoffFormat ?? existing.playoffFormat,
          divisionWinnersQualify:
            args.divisionWinnersQualify ?? existing.divisionWinnersQualify,
        }),
        created: false,
      };
    }

    const seasonId = await ctx.db.insert("seasons", {
      ...args,
      rosterLocked: false,
    });
    return {
      dto: toSeasonDto({
        _id: seasonId,
        name: args.name,
        leagueId: args.leagueId,
        startDate: args.startDate,
        endDate: args.endDate,
        status: args.status,
        rosterLocked: false,
        playoffTeams: args.playoffTeams,
        playoffFormat: args.playoffFormat,
        divisionWinnersQualify: args.divisionWinnersQualify,
      }),
      created: true,
    };
  },
});

/**
 * Update a season's name and dates by id (WSM-000126). Rename + edit; the
 * active status is managed separately via setActiveSeason.
 */
export const updateSeason = internalMutationGeneric({
  args: {
    seasonId: v.id("seasons"),
    name: v.string(),
    startDate: v.union(v.string(), v.null()),
    endDate: v.union(v.string(), v.null()),
    playoffTeams: v.optional(v.number()),
    playoffFormat: v.optional(v.string()),
    divisionWinnersQualify: v.optional(v.boolean()),
  },
  returns: v.union(
    v.object({
      id: v.string(),
      name: v.string(),
      leagueId: v.string(),
      startDate: v.union(v.string(), v.null()),
      endDate: v.union(v.string(), v.null()),
      status: v.string(),
      rosterLocked: v.boolean(),
      playoffTeams: v.optional(v.union(v.number(), v.null())),
      playoffFormat: v.optional(v.union(v.string(), v.null())),
      divisionWinnersQualify: v.optional(v.boolean()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.seasonId);
    if (!existing) return null;
    const patch: Record<string, unknown> = {
      name: args.name,
      startDate: args.startDate,
      endDate: args.endDate,
    };
    if (args.playoffTeams !== undefined) patch.playoffTeams = args.playoffTeams;
    if (args.playoffFormat !== undefined) patch.playoffFormat = args.playoffFormat;
    if (args.divisionWinnersQualify !== undefined) {
      patch.divisionWinnersQualify = args.divisionWinnersQualify;
    }
    await ctx.db.patch(args.seasonId, patch);
    return toSeasonDto({
      ...existing,
      name: args.name,
      startDate: args.startDate,
      endDate: args.endDate,
      playoffTeams: args.playoffTeams ?? existing.playoffTeams,
      playoffFormat: args.playoffFormat ?? existing.playoffFormat,
      divisionWinnersQualify:
        args.divisionWinnersQualify ?? existing.divisionWinnersQualify,
    });
  },
});

/**
 * Make a season its league's single active season (WSM-000126). Sets the target
 * to "active" and demotes any other active season in the same league to
 * "completed", preserving the exactly-one-active invariant that roster /
 * attribute / standings views resolve against.
 */
export const setActiveSeason = internalMutationGeneric({
  args: { seasonId: v.id("seasons") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const target = await ctx.db.get(args.seasonId);
    if (!target) return null;
    const siblings = await ctx.db
      .query("seasons")
      .withIndex("by_leagueId", (q) => q.eq("leagueId", target.leagueId))
      .collect();
    for (const s of siblings) {
      if (s._id === args.seasonId) continue;
      if (s.status === "active") {
        await ctx.db.patch(s._id, { status: "completed" });
      }
    }
    await ctx.db.patch(args.seasonId, { status: "active" });
    return null;
  },
});

/**
 * Mark a season completed (WSM-000217). Requires the playoff bracket to have a
 * decided champion unless `force` is passed (admin override for seasons without
 * playoffs or abandoned mid-way). Completed seasons are read-only for game
 * data: createFixture / generateSeasonSchedule / recordGameResult /
 * generatePlayoffBracket all reject with "season_completed" (which also blocks
 * every simulation path, since sims persist through recordGameResult).
 * Reactivating via setActiveSeason is the escape hatch.
 */
export const completeSeason = internalMutationGeneric({
  args: { seasonId: v.id("seasons"), force: v.optional(v.boolean()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const season = await ctx.db.get(args.seasonId);
    if (!season) throw new Error("season_not_found");
    if (season.status === "completed") return null;

    if (!args.force) {
      const bracket = await ctx.db
        .query("playoffBrackets")
        .withIndex("by_seasonId", (q) => q.eq("seasonId", args.seasonId))
        .first();
      const matchups = bracket
        ? await ctx.db
            .query("playoffMatchups")
            .withIndex("by_bracketId", (q) => q.eq("bracketId", bracket._id))
            .collect()
        : [];
      const champion = bracket
        ? championFromMatchups(matchups, bracket.format ?? "single")
        : null;
      if (!champion) throw new Error("no_champion");
    }

    await ctx.db.patch(args.seasonId, { status: "completed" });
    return null;
  },
});

/**
 * Delete a season and cascade its season-scoped rows (WSM-000126, WSM-000209):
 * fixtures and per-fixture game data, depth chart, playoff bracket rows, player
 * attributes, and roster assignments. rosterAuditLog is intentionally retained
 * (audit trail; no by_seasonId index).
 */
export const deleteSeason = internalMutationGeneric({
  args: { seasonId: v.id("seasons") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const season = await ctx.db.get(args.seasonId);
    if (!season) return null;

    const fixtures = await ctx.db
      .query("fixtures")
      .withIndex("by_seasonId", (q) => q.eq("seasonId", args.seasonId))
      .collect();
    for (const f of fixtures) {
      for (const gr of await ctx.db
        .query("gameResults")
        .withIndex("by_fixtureId", (q) => q.eq("fixtureId", f._id))
        .collect())
        await ctx.db.delete(gr._id);
      for (const pgs of await ctx.db
        .query("playerGameStats")
        .withIndex("by_fixtureId", (q) => q.eq("fixtureId", f._id))
        .collect())
        await ctx.db.delete(pgs._id);
      for (const gpl of await ctx.db
        .query("gamePlayLogs")
        .withIndex("by_fixtureId", (q) => q.eq("fixtureId", f._id))
        .collect())
        await ctx.db.delete(gpl._id);
      for (const gs of await ctx.db
        .query("gameStreams")
        .withIndex("by_fixtureId", (q) => q.eq("fixtureId", f._id))
        .collect())
        await ctx.db.delete(gs._id);
      for (const lgs of await ctx.db
        .query("liveGameState")
        .withIndex("by_fixtureId", (q) => q.eq("fixtureId", f._id))
        .collect())
        await ctx.db.delete(lgs._id);
      await ctx.db.delete(f._id);
    }

    const teams = await ctx.db
      .query("teams")
      .withIndex("by_leagueId", (q) => q.eq("leagueId", season.leagueId))
      .collect();
    for (const team of teams) {
      for (const dce of await ctx.db
        .query("depthChartEntries")
        .withIndex("by_team_season", (q) => q.eq("teamId", team._id))
        .collect()) {
        if (dce.seasonId !== args.seasonId) continue;
        await ctx.db.delete(dce._id);
      }
    }

    for (const pm of await ctx.db
      .query("playoffMatchups")
      .withIndex("by_seasonId", (q) => q.eq("seasonId", args.seasonId))
      .collect())
      await ctx.db.delete(pm._id);

    for (const pb of await ctx.db
      .query("playoffBrackets")
      .withIndex("by_seasonId", (q) => q.eq("seasonId", args.seasonId))
      .collect())
      await ctx.db.delete(pb._id);

    for (const pa of await ctx.db
      .query("playerAttributes")
      .withIndex("by_seasonId_positionGroup", (q) =>
        q.eq("seasonId", args.seasonId),
      )
      .collect())
      await ctx.db.delete(pa._id);

    for (const ra of await ctx.db
      .query("rosterAssignments")
      .withIndex("by_seasonId_teamId", (q) => q.eq("seasonId", args.seasonId))
      .collect())
      await ctx.db.delete(ra._id);

    // rosterAuditLog intentionally retained — audit trail; no by_seasonId index.

    await ctx.db.delete(args.seasonId);
    return null;
  },
});

export const setLeagueInviteToken = internalMutationGeneric({
  args: {
    leagueId: v.id("leagues"),
    token: v.union(v.string(), v.null()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.leagueId, {
      inviteToken: args.token,
    });
    return null;
  },
});

/**
 * Fork a reference team into an org's PRIVATE workspace (WSM-000114). Creates
 * (or reuses) the org's workspace league for the source league, then copies the
 * team + its roster into it — `orgId`-owned, isolated from the reference and
 * other orgs. Idempotent per (org, sourceTeam). Source links let ratings +
 * provenance resolve back to the reference. This replaces the shared-edit
 * claimTeam path under the private-only workspace model (RFC §11).
 */
/**
 * Get-or-create the org's PRIVATE workspace league mirroring `refLeague`.
 * Shared by the single-team and batch (division/conference) fork paths so the
 * idempotent "one workspace league per reference league per org" rule holds.
 */
async function ensureWorkspaceLeague(
  ctx: MutationCtx,
  orgId: string,
  refLeague: { _id: Id<"leagues">; name: string },
): Promise<Id<"leagues">> {
  const existing =
    (
      await ctx.db
        .query("leagues")
        .withIndex("by_orgId", (q) => q.eq("orgId", orgId))
        .collect()
    ).find((l) => l.sourceLeagueId === refLeague._id) ?? null;
  if (existing) return existing._id;
  return ctx.db.insert("leagues", {
    name: refLeague.name,
    orgId,
    isPublic: false,
    inviteToken: null,
    sourceLeagueId: refLeague._id,
  });
}

/**
 * Mirror a reference conference into the workspace (by name), get-or-create.
 * Returns the workspace conference id, or null when the reference team/division
 * has no conference. Keeps the workspace hierarchy parallel to the reference.
 */
async function ensureWorkspaceConference(
  ctx: MutationCtx,
  workspaceLeagueId: Id<"leagues">,
  refConferenceId: Id<"conferences"> | null | undefined,
): Promise<Id<"conferences"> | null> {
  if (!refConferenceId) return null;
  const refConf = await ctx.db.get(refConferenceId);
  if (!refConf) return null;
  const existingConf =
    (
      await ctx.db
        .query("conferences")
        .withIndex("by_leagueId", (q) => q.eq("leagueId", workspaceLeagueId))
        .collect()
    ).find((c) => c.name === refConf.name) ?? null;
  if (existingConf) return existingConf._id;
  return ctx.db.insert("conferences", {
    name: refConf.name,
    leagueId: workspaceLeagueId,
    sourceConferenceId: refConf._id,
  });
}

/**
 * Mirror a reference division into the workspace (by name), get-or-create,
 * carrying its conference link. Returns null when the team has no division.
 */
async function ensureWorkspaceDivision(
  ctx: MutationCtx,
  workspaceLeagueId: Id<"leagues">,
  refDivisionId: Id<"divisions"> | null | undefined,
): Promise<Id<"divisions"> | null> {
  if (!refDivisionId) return null;
  const refDiv = await ctx.db.get(refDivisionId);
  if (!refDiv) return null;
  const existingDiv =
    (
      await ctx.db
        .query("divisions")
        .withIndex("by_leagueId", (q) => q.eq("leagueId", workspaceLeagueId))
        .collect()
    ).find((d) => d.name === refDiv.name) ?? null;
  if (existingDiv) return existingDiv._id;
  const workspaceConferenceId = await ensureWorkspaceConference(
    ctx,
    workspaceLeagueId,
    refDiv.conferenceId,
  );
  return ctx.db.insert("divisions", {
    name: refDiv.name,
    leagueId: workspaceLeagueId,
    ...(workspaceConferenceId ? { conferenceId: workspaceConferenceId } : {}),
  });
}

/**
 * Fork a single reference team (+ roster) into an already-resolved workspace
 * league. Idempotent per (workspace league, source team). The reference league
 * forkability check is the CALLER's responsibility. Returns the workspace team
 * id and whether it was newly created (false = already forked).
 */
async function forkOneTeamInto(
  ctx: MutationCtx,
  orgId: string,
  workspaceLeagueId: Id<"leagues">,
  sourceTeamId: Id<"teams">,
): Promise<{ teamId: Id<"teams">; created: boolean }> {
  const refTeam = await ctx.db.get(sourceTeamId);
  if (!refTeam) throw new Error("Source team not found");

  const existing =
    (
      await ctx.db
        .query("teams")
        .withIndex("by_leagueId", (q) => q.eq("leagueId", workspaceLeagueId))
        .collect()
    ).find((t) => t.sourceTeamId === sourceTeamId) ?? null;
  if (existing) return { teamId: existing._id, created: false };

  const workspaceDivisionId = await ensureWorkspaceDivision(
    ctx,
    workspaceLeagueId,
    refTeam.divisionId,
  );

  const newTeamId = await ctx.db.insert("teams", {
    name: refTeam.name,
    leagueId: workspaceLeagueId,
    divisionId: workspaceDivisionId,
    city: refTeam.city,
    stadium: refTeam.stadium,
    foundedYear: refTeam.foundedYear,
    location: refTeam.location,
    logoUrl: refTeam.logoUrl,
    rosterLimit: refTeam.rosterLimit,
    ownerOrgId: orgId,
    sourceTeamId: sourceTeamId,
  });

  const refPlayers = await ctx.db
    .query("players")
    .withIndex("by_teamId", (q) => q.eq("teamId", sourceTeamId))
    .collect();
  for (const p of refPlayers) {
    await ctx.db.insert("players", {
      name: p.name,
      leagueId: workspaceLeagueId,
      teamId: newTeamId,
      position: p.position,
      positionGroup: p.positionGroup,
      jerseyNumber: p.jerseyNumber,
      dateOfBirth: p.dateOfBirth,
      status: p.status,
      headshotUrl: p.headshotUrl,
      experienceYears: p.experienceYears,
      sourcePlayerId: p._id,
    });
  }

  return { teamId: newTeamId, created: true };
}

/** Reference league a team can be forked from, or throw if not forkable. */
async function requireForkableLeague(
  ctx: MutationCtx,
  refLeagueId: Id<"leagues">,
): Promise<{ _id: Id<"leagues">; name: string }> {
  const refLeague = await ctx.db.get(refLeagueId);
  // Forkable = a public reference league we've marked claimable (the curated
  // "discovery data we allow"). Workspace leagues (private) aren't forkable.
  if (!refLeague || !refLeague.isPublic || !refLeague.claimable) {
    throw new Error("Team is not forkable");
  }
  return { _id: refLeague._id, name: refLeague.name };
}

export const forkTeamToWorkspace = internalMutationGeneric({
  args: { orgId: v.string(), sourceTeamId: v.id("teams") },
  returns: v.object({
    teamId: v.string(),
    leagueId: v.string(),
    created: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const refTeam = await ctx.db.get(args.sourceTeamId);
    if (!refTeam) throw new Error("Source team not found");
    const refLeague = await requireForkableLeague(ctx, refTeam.leagueId);
    const workspaceLeagueId = await ensureWorkspaceLeague(
      ctx,
      args.orgId,
      refLeague,
    );
    const { teamId, created } = await forkOneTeamInto(
      ctx,
      args.orgId,
      workspaceLeagueId,
      args.sourceTeamId,
    );
    return {
      teamId: teamId as string,
      leagueId: workspaceLeagueId as string,
      created,
    };
  },
});

/**
 * Reverse of forkTeamToWorkspace (WSM-000129): un-add a team by deleting the
 * org's PRIVATE workspace fork of a reference team. Scans the org's workspace
 * leagues for the fork whose `sourceTeamId` matches and purges it (roster +
 * dependents, via purgeTeam). Idempotent — `removed: false` when the org holds
 * no fork of that source team. Admin authorization is the caller's job (the
 * /unclaim route resolves the org from the caller's admin memberships, and
 * forks only ever live in orgs the caller admins).
 */
export const unforkTeamFromWorkspace = internalMutationGeneric({
  args: { orgId: v.string(), sourceTeamId: v.id("teams") },
  returns: v.object({ removed: v.boolean() }),
  handler: async (ctx, args) => {
    const workspaceLeagues = await ctx.db
      .query("leagues")
      .withIndex("by_orgId", (q) => q.eq("orgId", args.orgId))
      .collect();
    for (const league of workspaceLeagues) {
      const fork = (
        await ctx.db
          .query("teams")
          .withIndex("by_leagueId", (q) => q.eq("leagueId", league._id))
          .collect()
      ).find((t) => t.sourceTeamId === args.sourceTeamId);
      if (fork) {
        await purgeTeam(ctx, fork._id);
        return { removed: true };
      }
    }
    return { removed: false };
  },
});

/**
 * À la carte by division (WSM-000133): fork EVERY team in a reference division
 * into the org's workspace in one idempotent action. Already-forked teams are
 * skipped (no duplicates), so re-running over a partially-added division adds
 * only the remaining teams. Returns per-division counts the UI uses to render
 * added/partial/all state.
 */
export const forkDivisionToWorkspace = internalMutationGeneric({
  args: { orgId: v.string(), divisionId: v.id("divisions") },
  returns: v.object({
    leagueId: v.string(),
    totalTeams: v.number(),
    forkedTeams: v.number(),
    alreadyForked: v.number(),
  }),
  handler: async (ctx, args) => {
    const refDiv = await ctx.db.get(args.divisionId);
    if (!refDiv) throw new Error("Source division not found");
    const refLeague = await requireForkableLeague(ctx, refDiv.leagueId);
    const workspaceLeagueId = await ensureWorkspaceLeague(
      ctx,
      args.orgId,
      refLeague,
    );

    const refTeams = await ctx.db
      .query("teams")
      .withIndex("by_divisionId", (q) => q.eq("divisionId", args.divisionId))
      .collect();

    let forkedTeams = 0;
    let alreadyForked = 0;
    for (const t of refTeams) {
      const { created } = await forkOneTeamInto(
        ctx,
        args.orgId,
        workspaceLeagueId,
        t._id,
      );
      if (created) forkedTeams += 1;
      else alreadyForked += 1;
    }

    return {
      leagueId: workspaceLeagueId as string,
      totalTeams: refTeams.length,
      forkedTeams,
      alreadyForked,
    };
  },
});

/**
 * À la carte by conference (WSM-000133, optimal AC): fork every team in every
 * division under a reference conference. Idempotent — already-forked teams are
 * skipped. Returns aggregate counts across all the conference's divisions.
 */
export const forkConferenceToWorkspace = internalMutationGeneric({
  args: { orgId: v.string(), conferenceId: v.id("conferences") },
  returns: v.object({
    leagueId: v.string(),
    totalTeams: v.number(),
    forkedTeams: v.number(),
    alreadyForked: v.number(),
  }),
  handler: async (ctx, args) => {
    const refConf = await ctx.db.get(args.conferenceId);
    if (!refConf) throw new Error("Source conference not found");
    const refLeague = await requireForkableLeague(ctx, refConf.leagueId);
    const workspaceLeagueId = await ensureWorkspaceLeague(
      ctx,
      args.orgId,
      refLeague,
    );

    const divisions = await ctx.db
      .query("divisions")
      .withIndex("by_conferenceId", (q) =>
        q.eq("conferenceId", args.conferenceId),
      )
      .collect();

    let totalTeams = 0;
    let forkedTeams = 0;
    let alreadyForked = 0;
    for (const div of divisions) {
      const refTeams = await ctx.db
        .query("teams")
        .withIndex("by_divisionId", (q) => q.eq("divisionId", div._id))
        .collect();
      totalTeams += refTeams.length;
      for (const t of refTeams) {
        const { created } = await forkOneTeamInto(
          ctx,
          args.orgId,
          workspaceLeagueId,
          t._id,
        );
        if (created) forkedTeams += 1;
        else alreadyForked += 1;
      }
    }

    return {
      leagueId: workspaceLeagueId as string,
      totalTeams,
      forkedTeams,
      alreadyForked,
    };
  },
});

export const setSyncEnabled = internalMutationGeneric({
  args: { enabled: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("syncConfigs")
      .withIndex("by_key", (q) => q.eq("key", "nfl"))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        syncEnabled: args.enabled,
      });
    } else {
      await ctx.db.insert("syncConfigs", {
        key: "nfl",
        syncEnabled: args.enabled,
        lastSyncReportJson: null,
      });
    }
    return null;
  },
});

export const writeSyncReport = internalMutationGeneric({
  args: {
    reportJson: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("syncConfigs")
      .withIndex("by_key", (q) => q.eq("key", "nfl"))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        lastSyncReportJson: args.reportJson,
      });
    } else {
      await ctx.db.insert("syncConfigs", {
        key: "nfl",
        syncEnabled: false,
        lastSyncReportJson: args.reportJson,
      });
    }
    return null;
  },
});

const depthChartEntryDto = v.object({
  id: v.string(),
  teamId: v.string(),
  seasonId: v.string(),
  playerId: v.string(),
  positionSlot: v.string(),
  sortOrder: v.number(),
  updatedAt: v.string(),
});

export const getDepthChartByTeamSeason = query({
  args: {
    teamId: v.id("teams"),
    seasonId: v.id("seasons"),
  },
  returns: v.array(depthChartEntryDto),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("depthChartEntries")
      .withIndex("by_team_season", (q) =>
        q.eq("teamId", args.teamId).eq("seasonId", args.seasonId),
      )
      .collect();
    return rows
      .sort((a, b) => {
        if (a.positionSlot !== b.positionSlot) {
          return a.positionSlot.localeCompare(b.positionSlot);
        }
        return a.sortOrder - b.sortOrder;
      })
      .map((row) => ({
        id: row._id,
        teamId: row.teamId,
        seasonId: row.seasonId,
        playerId: row.playerId,
        positionSlot: row.positionSlot,
        sortOrder: row.sortOrder,
        updatedAt: row.updatedAt,
      }));
  },
});

export const reorderDepthChart = internalMutation({
  args: {
    teamId: v.id("teams"),
    seasonId: v.id("seasons"),
    positionSlot: v.string(),
    playerIds: v.array(v.id("players")),
  },
  returns: v.array(depthChartEntryDto),
  handler: async (ctx, args) => {
    const season = await ctx.db.get(args.seasonId);
    if (!season) {
      throw new Error("season_not_found");
    }
    if (season.rosterLocked === true) {
      throw new Error("season_locked");
    }

    const players = await Promise.all(
      args.playerIds.map((id) => ctx.db.get(id)),
    );
    for (const [index, player] of players.entries()) {
      if (!player) {
        throw new Error(`invalid_player:${args.playerIds[index]}`);
      }
      if (player.teamId !== args.teamId) {
        throw new Error(`player_not_on_team:${args.playerIds[index]}`);
      }
    }

    const existing = await ctx.db
      .query("depthChartEntries")
      .withIndex("by_team_season_position", (q) =>
        q
          .eq("teamId", args.teamId)
          .eq("seasonId", args.seasonId)
          .eq("positionSlot", args.positionSlot),
      )
      .collect();
    await Promise.all(existing.map((row) => ctx.db.delete(row._id)));

    const updatedAt = new Date().toISOString();
    const insertedIds = await Promise.all(
      args.playerIds.map((playerId, index) =>
        ctx.db.insert("depthChartEntries", {
          teamId: args.teamId,
          seasonId: args.seasonId,
          playerId,
          positionSlot: args.positionSlot,
          sortOrder: index,
          updatedAt,
        }),
      ),
    );

    return insertedIds.map((id, index) => ({
      id,
      teamId: args.teamId,
      seasonId: args.seasonId,
      playerId: args.playerIds[index],
      positionSlot: args.positionSlot,
      sortOrder: index,
      updatedAt,
    }));
  },
});

export const setRosterLocked = internalMutation({
  args: {
    seasonId: v.id("seasons"),
    locked: v.boolean(),
  },
  returns: v.object({
    seasonId: v.string(),
    rosterLocked: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const season = await ctx.db.get(args.seasonId);
    if (!season) {
      throw new Error("season_not_found");
    }
    await ctx.db.patch(args.seasonId, { rosterLocked: args.locked });
    return { seasonId: args.seasonId, rosterLocked: args.locked };
  },
});

async function assignPlayerToRosterCore(
  ctx: MutationCtx,
  args: {
    seasonId: Id<"seasons">;
    teamId: Id<"teams">;
    playerId: Id<"players">;
    positionSlot: string;
    actorUserId: string;
    enforceRosterLimit?: boolean;
  },
): Promise<Infer<typeof rosterAssignmentDtoValidator>> {
  const [season, team, player] = await Promise.all([
    ctx.db.get(args.seasonId),
    ctx.db.get(args.teamId),
    ctx.db.get(args.playerId),
  ]);
  if (!season) throw new Error("season_not_found");
  if (!team) throw new Error("team_not_found");
  if (!player) throw new Error("player_not_found");
  if (season.rosterLocked === true) throw new Error("season_locked");
  if (team.leagueId !== season.leagueId) {
    throw new Error("team_season_league_mismatch");
  }
  if (player.teamId !== args.teamId) {
    throw new Error("player_not_on_team");
  }

  const teamAssignments = await ctx.db
    .query("rosterAssignments")
    .withIndex("by_seasonId_teamId", (q) =>
      q.eq("seasonId", args.seasonId).eq("teamId", args.teamId),
    )
    .collect();

  const activeForPlayer = teamAssignments.find(
    (row) => row.playerId === args.playerId && row.status === "active",
  );
  if (activeForPlayer) {
    throw new Error("player_already_on_roster");
  }

  const activeCount = teamAssignments.filter(
    (row) => row.status === "active",
  ).length;
  if (
    args.enforceRosterLimit !== false &&
    team.rosterLimit !== null &&
    activeCount >= team.rosterLimit
  ) {
    throw new Error("roster_limit_exceeded");
  }

  const slotActive = teamAssignments.filter(
    (row) => row.status === "active" && row.positionSlot === args.positionSlot,
  );
  const nextDepthRank =
    slotActive.reduce((max, row) => Math.max(max, row.depthRank), 0) + 1;

  const assignedAt = new Date().toISOString();
  const insertedId = await ctx.db.insert("rosterAssignments", {
    seasonId: args.seasonId,
    teamId: args.teamId,
    playerId: args.playerId,
    leagueId: team.leagueId,
    depthRank: nextDepthRank,
    positionSlot: args.positionSlot,
    status: "active",
    assignedAt,
    assignedBy: args.actorUserId,
  });

  const after = {
    id: insertedId,
    seasonId: args.seasonId,
    teamId: args.teamId,
    playerId: args.playerId,
    leagueId: team.leagueId,
    depthRank: nextDepthRank,
    positionSlot: args.positionSlot,
    status: "active",
    assignedAt,
    assignedBy: args.actorUserId,
  };

  await writeAuditLog(ctx, {
    leagueId: team.leagueId,
    teamId: args.teamId,
    seasonId: args.seasonId,
    actorUserId: args.actorUserId,
    action: "assign",
    before: null,
    after,
  });

  return toRosterAssignmentDto({ _id: insertedId, ...after });
}

async function appendDefaultDepthChartSlot(
  ctx: MutationCtx,
  args: {
    teamId: Id<"teams">;
    seasonId: Id<"seasons">;
    playerId: Id<"players">;
    positionSlot: string;
  },
): Promise<void> {
  const existing = await ctx.db
    .query("depthChartEntries")
    .withIndex("by_team_season_position", (q) =>
      q
        .eq("teamId", args.teamId)
        .eq("seasonId", args.seasonId)
        .eq("positionSlot", args.positionSlot),
    )
    .collect();
  const nextSortOrder =
    existing.reduce((max, row) => Math.max(max, row.sortOrder), -1) + 1;
  await ctx.db.insert("depthChartEntries", {
    teamId: args.teamId,
    seasonId: args.seasonId,
    playerId: args.playerId,
    positionSlot: args.positionSlot,
    sortOrder: nextSortOrder,
    updatedAt: new Date().toISOString(),
  });
}

async function resolveOffseasonSeasonIds(
  ctx: MutationCtx,
  leagueId: Id<"leagues">,
): Promise<Id<"seasons">[]> {
  const seasons = await ctx.db
    .query("seasons")
    .withIndex("by_leagueId", (q) => q.eq("leagueId", leagueId))
    .collect();
  return seasons
    .filter((s) => s.status === "active" || s.status === "upcoming")
    .map((s) => s._id);
}

async function resolvePlayerOverall(
  ctx: QueryCtx,
  playerId: Id<"players">,
  seasonId: Id<"seasons"> | null,
): Promise<number | null> {
  const player = await ctx.db.get(playerId);
  const ratingPlayerId = player?.sourcePlayerId ?? playerId;

  if (seasonId) {
    const attr = await ctx.db
      .query("playerAttributes")
      .withIndex("by_playerId_seasonId", (q) =>
        q.eq("playerId", ratingPlayerId).eq("seasonId", seasonId),
      )
      .first();
    if (attr?.weightedOverall != null) return attr.weightedOverall;
  }

  const madden = await ctx.db
    .query("maddenRatings")
    .withIndex("by_playerId", (q) => q.eq("playerId", ratingPlayerId))
    .first();
  return madden?.overall ?? null;
}

export const assignPlayerToRoster = internalMutation({
  args: {
    seasonId: v.id("seasons"),
    teamId: v.id("teams"),
    playerId: v.id("players"),
    positionSlot: v.string(),
    actorUserId: v.string(),
  },
  returns: rosterAssignmentDtoValidator,
  handler: async (ctx, args) => assignPlayerToRosterCore(ctx, args),
});

async function compactSlotRanks(
  ctx: MutationCtx,
  seasonId: Id<"seasons">,
  teamId: Id<"teams">,
  positionSlot: string,
): Promise<void> {
  const slotRows = await ctx.db
    .query("rosterAssignments")
    .withIndex("by_seasonId_teamId_position", (q) =>
      q
        .eq("seasonId", seasonId)
        .eq("teamId", teamId)
        .eq("positionSlot", positionSlot),
    )
    .collect();

  const active = slotRows
    .filter((row) => row.status === "active")
    .sort((a, b) => a.depthRank - b.depthRank);

  await Promise.all(
    active.map((row, index) => {
      const desired = index + 1;
      if (row.depthRank === desired) return Promise.resolve();
      return ctx.db.patch(row._id, { depthRank: desired });
    }),
  );
}

export const removePlayerFromRoster = internalMutation({
  args: {
    assignmentId: v.id("rosterAssignments"),
    actorUserId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const assignment = await ctx.db.get(args.assignmentId);
    if (!assignment) throw new Error("assignment_not_found");

    const season = await ctx.db.get(assignment.seasonId);
    if (!season) throw new Error("season_not_found");
    if (season.rosterLocked === true) throw new Error("season_locked");

    if (assignment.status !== "active") {
      throw new Error("cannot_remove_non_active");
    }

    const before = toRosterAssignmentDto(assignment);

    await ctx.db.delete(args.assignmentId);
    await compactSlotRanks(
      ctx,
      assignment.seasonId,
      assignment.teamId,
      assignment.positionSlot,
    );

    await writeAuditLog(ctx, {
      leagueId: assignment.leagueId,
      teamId: assignment.teamId,
      seasonId: assignment.seasonId,
      actorUserId: args.actorUserId,
      action: "remove",
      before,
      after: null,
    });

    return null;
  },
});

export const updateRosterStatus = internalMutation({
  args: {
    assignmentId: v.id("rosterAssignments"),
    newStatus: v.string(),
    actorUserId: v.string(),
  },
  returns: rosterAssignmentDtoValidator,
  handler: async (ctx, args) => {
    assertValidRosterStatus(args.newStatus);

    const assignment = await ctx.db.get(args.assignmentId);
    if (!assignment) throw new Error("assignment_not_found");

    const season = await ctx.db.get(assignment.seasonId);
    if (!season) throw new Error("season_not_found");
    if (season.rosterLocked === true) throw new Error("season_locked");

    if (assignment.status === args.newStatus) {
      return toRosterAssignmentDto(assignment);
    }

    const before = toRosterAssignmentDto(assignment);

    const wasActive = assignment.status === "active";
    const willBeActive = args.newStatus === "active";

    let nextDepthRank = assignment.depthRank;

    if (!wasActive && willBeActive) {
      const team = await ctx.db.get(assignment.teamId);
      if (!team) throw new Error("team_not_found");

      const teamAssignments = await ctx.db
        .query("rosterAssignments")
        .withIndex("by_seasonId_teamId", (q) =>
          q.eq("seasonId", assignment.seasonId).eq("teamId", assignment.teamId),
        )
        .collect();

      const activeCount = teamAssignments.filter(
        (row) => row.status === "active" && row._id !== assignment._id,
      ).length;
      if (team.rosterLimit !== null && activeCount >= team.rosterLimit) {
        throw new Error("roster_limit_exceeded");
      }

      const slotActive = teamAssignments.filter(
        (row) =>
          row.status === "active" &&
          row.positionSlot === assignment.positionSlot &&
          row._id !== assignment._id,
      );
      nextDepthRank =
        slotActive.reduce((max, row) => Math.max(max, row.depthRank), 0) + 1;
    } else if (wasActive && !willBeActive) {
      nextDepthRank = 0;
    }

    await ctx.db.patch(args.assignmentId, {
      status: args.newStatus,
      depthRank: nextDepthRank,
    });

    if (wasActive && !willBeActive) {
      await compactSlotRanks(
        ctx,
        assignment.seasonId,
        assignment.teamId,
        assignment.positionSlot,
      );
    }

    const updated = await ctx.db.get(args.assignmentId);
    if (!updated) throw new Error("assignment_not_found");
    const after = toRosterAssignmentDto(updated);

    await writeAuditLog(ctx, {
      leagueId: assignment.leagueId,
      teamId: assignment.teamId,
      seasonId: assignment.seasonId,
      actorUserId: args.actorUserId,
      action: "status_change",
      before,
      after,
    });

    return after;
  },
});

export const getRosterBySeasonTeam = query({
  args: {
    seasonId: v.id("seasons"),
    teamId: v.id("teams"),
  },
  returns: v.array(rosterAssignmentDtoValidator),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("rosterAssignments")
      .withIndex("by_seasonId_teamId", (q) =>
        q.eq("seasonId", args.seasonId).eq("teamId", args.teamId),
      )
      .collect();

    const sorted = [...rows].sort((a, b) => {
      if (a.positionSlot !== b.positionSlot) {
        return a.positionSlot.localeCompare(b.positionSlot);
      }
      const aActive = a.status === "active" ? 0 : 1;
      const bActive = b.status === "active" ? 0 : 1;
      if (aActive !== bActive) return aActive - bActive;
      if (a.status === "active" && b.status === "active") {
        return a.depthRank - b.depthRank;
      }
      return a.assignedAt.localeCompare(b.assignedAt);
    });

    return sorted.map(toRosterAssignmentDto);
  },
});

export const getTeamRosterLimitStatus = query({
  args: {
    seasonId: v.id("seasons"),
    teamId: v.id("teams"),
  },
  returns: v.object({
    activeCount: v.number(),
    rosterLimit: v.union(v.number(), v.null()),
    remaining: v.union(v.number(), v.null()),
  }),
  handler: async (ctx, args) => {
    const team = await ctx.db.get(args.teamId);
    if (!team) throw new Error("team_not_found");

    const rows = await ctx.db
      .query("rosterAssignments")
      .withIndex("by_seasonId_teamId", (q) =>
        q.eq("seasonId", args.seasonId).eq("teamId", args.teamId),
      )
      .collect();

    const activeCount = rows.filter((row) => row.status === "active").length;
    const rosterLimit = team.rosterLimit ?? null;
    const remaining =
      rosterLimit === null ? null : Math.max(0, rosterLimit - activeCount);

    return { activeCount, rosterLimit, remaining };
  },
});

export const getRosterAssignmentHistory = query({
  args: {
    teamId: v.id("teams"),
    seasonId: v.id("seasons"),
    playerId: v.union(v.id("players"), v.null()),
    limit: v.union(v.number(), v.null()),
  },
  returns: v.array(rosterAuditLogDtoValidator),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("rosterAuditLog")
      .withIndex("by_teamId_createdAt", (q) => q.eq("teamId", args.teamId))
      .order("desc")
      .collect();

    const matchesSeason = (row: (typeof rows)[number]) =>
      row.seasonId === args.seasonId;

    const matchesPlayer = (row: (typeof rows)[number]) => {
      if (!args.playerId) return true;
      const needle = `"playerId":"${args.playerId}"`;
      return (
        (row.beforeJson ?? "").includes(needle) ||
        (row.afterJson ?? "").includes(needle)
      );
    };

    const filtered = rows.filter(
      (row) => matchesSeason(row) && matchesPlayer(row),
    );

    const limited =
      args.limit === null ? filtered : filtered.slice(0, args.limit);

    return limited.map(toRosterAuditLogDto);
  },
});

/*
 * Phase 2 — `player_attributes_v1` (Sprint 6B / WSM-000057).
 *
 * `ingestPlayerAttributes` upserts one playerAttributes row per
 * (playerId, seasonId). Inputs are pre-normalized by the data-api
 * wrapper — the mutation just persists the canonical pieces.
 *
 *   attributesJson  — already a JSON string of Record<string, number>
 *   pffSourceJson   — raw PFF payload as ingested (or null)
 *   maddenSourceJson — raw Madden payload as ingested (or null)
 *   pffWeight, maddenWeight — per-source weights, normalized at the
 *                              wrapper layer so they sum to 1 for the
 *                              sources that are present.
 *   weightedOverall — already computed at the wrapper layer (null if
 *                     neither source carried an "OVR"/"overall" attribute).
 */
export const ingestPlayerAttributes = internalMutationGeneric({
  args: {
    playerId: v.id("players"),
    seasonId: v.id("seasons"),
    positionGroup: v.string(),
    attributesJson: v.string(),
    pffSourceJson: v.union(v.string(), v.null()),
    maddenSourceJson: v.union(v.string(), v.null()),
    pffWeight: v.number(),
    maddenWeight: v.number(),
    weightedOverall: v.union(v.number(), v.null()),
  },
  returns: v.object({
    id: v.string(),
    created: v.boolean(),
  }),
  handler: async (ctx, args) => {
    // Look up by playerId via the compound by_playerId_seasonId index;
    // filter the (small) per-player set to the matching seasonId. We use
    // the leading-field-only form because the chained-eq form trips the
    // generic IndexRange typing under mutationGeneric — same outcome with
    // negligible cost (one player typically has 1 row per season).
    const candidates = await ctx.db
      .query("playerAttributes")
      .withIndex("by_playerId_seasonId", (q) =>
        q.eq("playerId", args.playerId),
      )
      .collect();
    const existing =
      candidates.find((row) => row.seasonId === args.seasonId) ?? null;

    const ingestedAt = new Date().toISOString();
    const payload = {
      playerId: args.playerId,
      seasonId: args.seasonId,
      positionGroup: args.positionGroup,
      attributesJson: args.attributesJson,
      pffSourceJson: args.pffSourceJson,
      maddenSourceJson: args.maddenSourceJson,
      pffWeight: args.pffWeight,
      maddenWeight: args.maddenWeight,
      weightedOverall: args.weightedOverall,
      ingestedAt,
    };

    if (existing) {
      await ctx.db.replace(existing._id, payload);
      return { id: existing._id, created: false };
    }
    const id = await ctx.db.insert("playerAttributes", payload);
    return { id, created: true };
  },
});

/*
 * Manual coach/admin edit of one player's current-season attribute snapshot.
 * Resolves workspace forks (source player + source league season) like
 * getPlayerSeasonAttributes, then upserts via the same storage path as
 * ingestPlayerAttributes. Not season-state gated — curation works mid-season.
 */
export const updatePlayerAttributes = internalMutationGeneric({
  args: {
    playerId: v.id("players"),
    positionGroup: v.string(),
    attributesJson: v.string(),
    weightedOverall: v.union(v.number(), v.null()),
  },
  returns: v.object({
    id: v.string(),
    created: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const player = await ctx.db.get(args.playerId);
    if (!player) throw new Error("player_not_found");

    const attrPlayer = player.sourcePlayerId
      ? ((await ctx.db.get(player.sourcePlayerId)) ?? player)
      : player;
    const seasonId = await currentSeasonId(
      ctx as MutationCtx,
      attrPlayer.leagueId,
    );
    if (!seasonId) throw new Error("no_season");

    const candidates = await ctx.db
      .query("playerAttributes")
      .withIndex("by_playerId_seasonId", (q) =>
        q.eq("playerId", attrPlayer._id),
      )
      .collect();
    const existing =
      candidates.find((row) => row.seasonId === seasonId) ?? null;

    const ingestedAt = new Date().toISOString();
    const payload = {
      playerId: attrPlayer._id,
      seasonId,
      positionGroup: args.positionGroup,
      attributesJson: args.attributesJson,
      pffSourceJson: null,
      maddenSourceJson: null,
      pffWeight: 0,
      maddenWeight: 1,
      weightedOverall: args.weightedOverall,
      ingestedAt,
    };

    if (existing) {
      await ctx.db.replace(existing._id, payload);
      return { id: existing._id, created: false };
    }
    const id = await ctx.db.insert("playerAttributes", payload);
    return { id, created: true };
  },
});

/*
 * WSM-000090 — bulk form of ingestPlayerAttributes for whole-league
 * ratings loads (a per-row CLI loop takes ~75 min for an NFL-sized
 * league; this does it in a handful of calls). Same upsert semantics
 * per row as the single mutation; rows are independent, so one bad
 * playerId fails the whole batch atomically (Convex mutation = one
 * transaction) — callers should pre-validate ids.
 */
/*
 * WSM-000091 — clear all attribute snapshots for a season. Used by the
 * SPRT ingest to drop stale/synthetic rows before loading real ratings,
 * so players without a computed rating fall back to "no snapshot" (em
 * dash) rather than showing leftover values. Idempotent.
 */
export const clearSeasonPlayerAttributes = internalMutationGeneric({
  args: { seasonId: v.id("seasons") },
  returns: v.object({ deleted: v.number() }),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("playerAttributes")
      .withIndex("by_seasonId_positionGroup", (q) =>
        q.eq("seasonId", args.seasonId),
      )
      .collect();
    for (const row of rows) await ctx.db.delete(row._id);
    return { deleted: rows.length };
  },
});

export const ingestPlayerAttributesBatch = internalMutationGeneric({
  args: {
    seasonId: v.id("seasons"),
    rows: v.array(
      v.object({
        playerId: v.id("players"),
        positionGroup: v.string(),
        attributesJson: v.string(),
        weightedOverall: v.union(v.number(), v.null()),
      }),
    ),
  },
  returns: v.object({ created: v.number(), updated: v.number() }),
  handler: async (ctx, args) => {
    const ingestedAt = new Date().toISOString();
    let created = 0;
    let updated = 0;
    for (const row of args.rows) {
      const candidates = await ctx.db
        .query("playerAttributes")
        .withIndex("by_playerId_seasonId", (q) =>
          q.eq("playerId", row.playerId),
        )
        .collect();
      const existing =
        candidates.find((r) => r.seasonId === args.seasonId) ?? null;
      const payload = {
        playerId: row.playerId,
        seasonId: args.seasonId,
        positionGroup: row.positionGroup,
        attributesJson: row.attributesJson,
        pffSourceJson: null,
        maddenSourceJson: null,
        pffWeight: 0,
        maddenWeight: 1,
        weightedOverall: row.weightedOverall,
        ingestedAt,
      };
      if (existing) {
        await ctx.db.replace(existing._id, payload);
        updated += 1;
      } else {
        await ctx.db.insert("playerAttributes", payload);
        created += 1;
      }
    }
    return { created, updated };
  },
});

/*
 * Phase 2 — Read API (Sprint 6B / WSM-000058).
 */

function safeParseAttributes(json: string): Record<string, number> {
  try {
    const parsed = JSON.parse(json);
    if (parsed && typeof parsed === "object") {
      const out: Record<string, number> = {};
      for (const [k, v2] of Object.entries(parsed)) {
        if (typeof v2 === "number" && Number.isFinite(v2)) out[k] = v2;
      }
      return out;
    }
  } catch {
    // fallthrough
  }
  return {};
}

const playerDevelopmentRowValidator = v.object({
  id: v.string(),
  seasonId: v.string(),
  seasonName: v.string(),
  seasonStartDate: v.union(v.string(), v.null()),
  positionGroup: v.string(),
  attributes: v.record(v.string(), v.number()),
  weightedOverall: v.union(v.number(), v.null()),
  delta: v.union(v.number(), v.null()),
  ingestedAt: v.string(),
});

export const getPlayerDevelopment = queryGeneric({
  args: { playerId: v.id("players") },
  returns: v.array(playerDevelopmentRowValidator),
  handler: async (ctx, args) => {
    // Workspace fork (WSM-000116): development history lives on the reference
    // player, so resolve through sourcePlayerId when present.
    const player = await ctx.db.get(args.playerId);
    const developmentPlayerId = player?.sourcePlayerId ?? args.playerId;
    const rows = await ctx.db
      .query("playerAttributes")
      .withIndex("by_playerId_seasonId", (q) =>
        q.eq("playerId", developmentPlayerId),
      )
      .collect();

    // Hydrate season info for sort + axis labels.
    const hydrated = await Promise.all(
      rows.map(async (row) => {
        const season = await ctx.db.get(row.seasonId);
        return {
          row,
          seasonName: season?.name ?? "(unknown)",
          seasonStartDate: season?.startDate ?? null,
        };
      }),
    );

    // Sort: startDate ASC (nulls last so a missing date doesn't skew
    // the chart). Compute delta vs the immediately-preceding row.
    hydrated.sort((a, b) => {
      const aKey = a.seasonStartDate ?? "9999";
      const bKey = b.seasonStartDate ?? "9999";
      return aKey.localeCompare(bKey);
    });

    let prevOverall: number | null = null;
    return hydrated.map(({ row, seasonName, seasonStartDate }) => {
      const overall = row.weightedOverall;
      const delta =
        overall !== null && prevOverall !== null
          ? overall - prevOverall
          : null;
      if (overall !== null) prevOverall = overall;
      return {
        id: row._id,
        seasonId: row.seasonId,
        seasonName,
        seasonStartDate,
        positionGroup: row.positionGroup,
        attributes: safeParseAttributes(row.attributesJson),
        weightedOverall: overall,
        delta,
        ingestedAt: row.ingestedAt,
      };
    });
  },
});

const seasonAttributesRowValidator = v.object({
  playerId: v.string(),
  playerName: v.string(),
  positionGroup: v.string(),
  attributes: v.record(v.string(), v.number()),
  weightedOverall: v.union(v.number(), v.null()),
  ingestedAt: v.string(),
});

export const getSeasonAttributesByPosition = queryGeneric({
  args: {
    seasonId: v.id("seasons"),
    positionGroup: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.array(seasonAttributesRowValidator),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("playerAttributes")
      .withIndex("by_seasonId_positionGroup", (q) =>
        q.eq("seasonId", args.seasonId),
      )
      .collect();

    const filtered = rows.filter(
      (row) => row.positionGroup === args.positionGroup,
    );

    // Sort by weightedOverall DESC (nulls last).
    filtered.sort((a, b) => {
      const aOverall = a.weightedOverall ?? -Infinity;
      const bOverall = b.weightedOverall ?? -Infinity;
      return bOverall - aOverall;
    });

    const limit = args.limit ?? 25;
    const limited = filtered.slice(0, limit);

    return Promise.all(
      limited.map(async (row) => {
        const player = await ctx.db.get(row.playerId);
        return {
          playerId: row.playerId,
          playerName: player?.name ?? "(unknown)",
          positionGroup: row.positionGroup,
          attributes: safeParseAttributes(row.attributesJson),
          weightedOverall: row.weightedOverall,
          ingestedAt: row.ingestedAt,
        };
      }),
    );
  },
});

/*
 * WSM-000090 — per-team attribute snapshots for the Madden-style
 * roster stat columns. One row per team player that has a snapshot
 * for the given season; players without one are simply absent (the
 * UI renders an em dash). Access control lives in the data-api layer
 * (league visibility), matching getPlayersByTeam.
 */
/*
 * WSM-000093 — single-player attribute snapshot for the profile rating
 * breakdown. Point read via by_playerId_seasonId. Access control lives
 * in the data-api layer, matching getPlayer.
 */
/*
 * The season whose attributes represent a league's "current" SPRT ratings —
 * the active season, else the most recently created. Matches the convention the
 * dashboard pages used to apply caller-side; centralized here so workspace
 * forks (whose own league has no seasons) resolve against their SOURCE league.
 */
async function currentSeasonId(
  ctx: QueryCtx,
  leagueId: Id<"leagues">,
): Promise<Id<"seasons"> | null> {
  const seasons = await ctx.db
    .query("seasons")
    .withIndex("by_leagueId", (q) => q.eq("leagueId", leagueId))
    .collect();
  const active = seasons.find((s) => s.status === "active");
  if (active) return active._id;
  if (seasons.length === 0) return null;
  const sorted = [...seasons].sort((a, b) => b._creationTime - a._creationTime);
  return sorted[0]!._id;
}

/*
 * The league whose seasons + players carry a team's SPRT attributes. A forked
 * workspace team (WSM-000122) holds no attributes of its own — they live on the
 * source reference team's players/season — so resolve through `sourceTeamId`.
 */
async function attributeLeagueId(
  ctx: QueryCtx,
  team: { leagueId: Id<"leagues">; sourceTeamId?: Id<"teams"> },
): Promise<Id<"leagues">> {
  if (team.sourceTeamId) {
    const source = await ctx.db.get(team.sourceTeamId);
    if (source) return source.leagueId;
  }
  return team.leagueId;
}

export const getPlayerSeasonAttributes = queryGeneric({
  args: {
    playerId: v.id("players"),
    // Optional + ignored now that the season is self-resolved (WSM-000122) —
    // kept so a previously-deployed web passing it still validates.
    seasonId: v.optional(v.id("seasons")),
  },
  returns: v.union(
    v.object({
      weightedOverall: v.union(v.number(), v.null()),
      attributes: v.record(v.string(), v.number()),
      positionGroup: v.string(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const player = await ctx.db.get(args.playerId);
    if (!player) return null;
    // Workspace fork: attributes live on the source player, keyed by the source
    // league's current season — so resolve both from the source (WSM-000122).
    const attrPlayer = player.sourcePlayerId
      ? ((await ctx.db.get(player.sourcePlayerId)) ?? player)
      : player;
    const seasonId = await currentSeasonId(ctx as QueryCtx, attrPlayer.leagueId);
    if (!seasonId) return null;
    const candidates = await ctx.db
      .query("playerAttributes")
      .withIndex("by_playerId_seasonId", (q) =>
        q.eq("playerId", attrPlayer._id),
      )
      .collect();
    const row = candidates.find((r) => r.seasonId === seasonId);
    if (!row) return null;
    return {
      weightedOverall: row.weightedOverall,
      attributes: safeParseAttributes(row.attributesJson),
      positionGroup: row.positionGroup,
    };
  },
});

export const getTeamAttributeSnapshots = queryGeneric({
  args: {
    teamId: v.id("teams"),
    // Optional + ignored now that the season is self-resolved (WSM-000122).
    seasonId: v.optional(v.id("seasons")),
  },
  returns: v.array(
    v.object({
      playerId: v.string(),
      weightedOverall: v.union(v.number(), v.null()),
      attributes: v.record(v.string(), v.number()),
    }),
  ),
  handler: async (ctx, args) => {
    const team = await ctx.db.get(args.teamId);
    if (!team) return [];

    // For a forked team this is the source reference league's current season;
    // for a native team, its own. Both source players' attributes are keyed by
    // this season (WSM-000122).
    const seasonId = await currentSeasonId(
      ctx as QueryCtx,
      await attributeLeagueId(ctx as QueryCtx, team),
    );
    if (!seasonId) return [];

    const players = await ctx.db
      .query("players")
      .withIndex("by_teamId", (q) => q.eq("teamId", args.teamId))
      .collect();

    const snapshots = [];
    for (const player of players) {
      const attrPlayerId = player.sourcePlayerId ?? player._id;
      // Leading-field index form — see ingestPlayerAttributes for why.
      const candidates = await ctx.db
        .query("playerAttributes")
        .withIndex("by_playerId_seasonId", (q) =>
          q.eq("playerId", attrPlayerId),
        )
        .collect();
      const row = candidates.find((r) => r.seasonId === seasonId);
      if (!row) continue;
      snapshots.push({
        playerId: player._id as string,
        weightedOverall: row.weightedOverall,
        attributes: safeParseAttributes(row.attributesJson),
      });
    }
    return snapshots;
  },
});

/*
 * Madden ratings (WSM-000095) — ingest + reads. One row per player; the
 * ingest upserts by playerId so a re-run refreshes in place.
 */
export const ingestMaddenRatingsBatch = internalMutationGeneric({
  args: {
    rows: v.array(
      v.object({
        playerId: v.id("players"),
        overall: v.number(),
        position: v.string(),
        attributesJson: v.string(),
        portraitUrl: v.union(v.string(), v.null()),
        teamLogoUrl: v.union(v.string(), v.null()),
      }),
    ),
  },
  returns: v.object({ created: v.number(), updated: v.number() }),
  handler: async (ctx, args) => {
    const ingestedAt = new Date().toISOString();
    let created = 0;
    let updated = 0;
    for (const row of args.rows) {
      const existing = await ctx.db
        .query("maddenRatings")
        .withIndex("by_playerId", (q) => q.eq("playerId", row.playerId))
        .unique();
      const payload = { ...row, ingestedAt };
      if (existing) {
        await ctx.db.replace(existing._id, payload);
        updated += 1;
      } else {
        await ctx.db.insert("maddenRatings", payload);
        created += 1;
      }
    }
    return { created, updated };
  },
});

const maddenRatingValidator = v.object({
  overall: v.number(),
  position: v.string(),
  attributes: v.record(v.string(), v.number()),
  portraitUrl: v.union(v.string(), v.null()),
  teamLogoUrl: v.union(v.string(), v.null()),
});

export const getPlayerMaddenRating = queryGeneric({
  args: { playerId: v.id("players") },
  returns: v.union(maddenRatingValidator, v.null()),
  handler: async (ctx, args) => {
    // Workspace fork (WSM-000116): ratings live on the reference player, so
    // resolve through sourcePlayerId when present.
    const player = await ctx.db.get(args.playerId);
    const ratingPlayerId = player?.sourcePlayerId ?? args.playerId;
    const row = await ctx.db
      .query("maddenRatings")
      .withIndex("by_playerId", (q) => q.eq("playerId", ratingPlayerId))
      .unique();
    if (!row) return null;
    return {
      overall: row.overall,
      position: row.position,
      attributes: safeParseAttributes(row.attributesJson),
      portraitUrl: row.portraitUrl,
      teamLogoUrl: row.teamLogoUrl,
    };
  },
});

export const getTeamMaddenOveralls = queryGeneric({
  args: { teamId: v.id("teams") },
  returns: v.array(
    v.object({ playerId: v.string(), overall: v.number() }),
  ),
  handler: async (ctx, args) => {
    const players = await ctx.db
      .query("players")
      .withIndex("by_teamId", (q) => q.eq("teamId", args.teamId))
      .collect();
    const out: Array<{ playerId: string; overall: number }> = [];
    for (const player of players) {
      // Workspace fork (WSM-000116): resolve ratings via the source player.
      const ratingPlayerId = player.sourcePlayerId ?? player._id;
      const row = await ctx.db
        .query("maddenRatings")
        .withIndex("by_playerId", (q) => q.eq("playerId", ratingPlayerId))
        .unique();
      if (row) out.push({ playerId: player._id as string, overall: row.overall });
    }
    return out;
  },
});

/*
 * Phase 2 — Public read primitives (Sprint 6B / WSM-000059).
 *
 * The public viewer in WSM-000061 hits these without a Clerk session.
 * Both queries gate on `league.isPublic === true`. No org-membership
 * check; visibility is the league's own opt-in.
 */

export const getLeagueVisibility = queryGeneric({
  args: { leagueId: v.id("leagues") },
  returns: v.union(v.object({ isPublic: v.boolean() }), v.null()),
  handler: async (ctx, args) => {
    const league = await ctx.db.get(args.leagueId);
    if (!league) return null;
    return { isPublic: league.isPublic };
  },
});

export const setLeaguePublic = internalMutationGeneric({
  args: {
    leagueId: v.id("leagues"),
    isPublic: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const league = await ctx.db.get(args.leagueId);
    if (!league) throw new Error("league_not_found");
    await ctx.db.patch(args.leagueId, { isPublic: args.isPublic });
    return null;
  },
});

/** Whether a league's teams can be claimed by coaches (WSM-000109). */
export const getLeagueClaimable = queryGeneric({
  args: { leagueId: v.id("leagues") },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const league = await ctx.db.get(args.leagueId);
    return league?.claimable === true;
  },
});

/*
 * Intra-org capability roles (WSM-000121). The Clerk admin bit and membership
 * are the source of truth; these functions only persist the coach/viewer split
 * for org:member users. A missing row means "viewer".
 */
// Compound-index `.eq().eq()` chaining doesn't type-check under the generic ctx
// (the second `.eq` sees an IndexRange), so query the orgId prefix and pick the
// user in JS — the same pattern used elsewhere in this file.
export const getOrgMemberRole = queryGeneric({
  args: { orgId: v.string(), userId: v.string() },
  returns: v.union(v.literal("coach"), v.literal("viewer"), v.null()),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("orgMemberRoles")
      .withIndex("by_orgId_userId", (q) => q.eq("orgId", args.orgId))
      .collect();
    const row = rows.find((r) => r.userId === args.userId);
    if (!row) return null;
    return row.role === "coach" ? "coach" : "viewer";
  },
});

export const listOrgMemberRoles = queryGeneric({
  args: { orgId: v.string() },
  returns: v.array(
    v.object({
      userId: v.string(),
      role: v.union(v.literal("coach"), v.literal("viewer")),
    }),
  ),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("orgMemberRoles")
      .withIndex("by_orgId_userId", (q) => q.eq("orgId", args.orgId))
      .collect();
    return rows.map((r) => ({
      userId: r.userId,
      role: (r.role === "coach" ? "coach" : "viewer") as "coach" | "viewer",
    }));
  },
});

export const setOrgMemberRole = internalMutationGeneric({
  args: {
    orgId: v.string(),
    userId: v.string(),
    role: v.union(v.literal("coach"), v.literal("viewer")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("orgMemberRoles")
      .withIndex("by_orgId_userId", (q) => q.eq("orgId", args.orgId))
      .collect();
    const existing = rows.find((r) => r.userId === args.userId);
    if (existing) {
      await ctx.db.patch(existing._id, { role: args.role });
    } else {
      await ctx.db.insert("orgMemberRoles", {
        orgId: args.orgId,
        userId: args.userId,
        role: args.role,
      });
    }
    return null;
  },
});

export const deleteOrgMemberRole = internalMutationGeneric({
  args: { orgId: v.string(), userId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("orgMemberRoles")
      .withIndex("by_orgId_userId", (q) => q.eq("orgId", args.orgId))
      .collect();
    const existing = rows.find((r) => r.userId === args.userId);
    if (existing) await ctx.db.delete(existing._id);
    return null;
  },
});

/** Mark a (public template) league's teams claimable by coaches (WSM-000109). */
export const setLeagueClaimable = internalMutationGeneric({
  args: {
    leagueId: v.id("leagues"),
    claimable: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const league = await ctx.db.get(args.leagueId);
    if (!league) throw new Error("league_not_found");
    await ctx.db.patch(args.leagueId, { claimable: args.claimable });
    return null;
  },
});

export const getPlayerDevelopmentPublic = queryGeneric({
  args: {
    leagueId: v.id("leagues"),
    playerId: v.id("players"),
  },
  returns: v.union(v.array(playerDevelopmentRowValidator), v.null()),
  handler: async (ctx, args) => {
    const league = await ctx.db.get(args.leagueId);
    if (!league || !league.isPublic) return null;

    const player = await ctx.db.get(args.playerId);
    if (!player || player.leagueId !== args.leagueId) return null;

    const rows = await ctx.db
      .query("playerAttributes")
      .withIndex("by_playerId_seasonId", (q) =>
        q.eq("playerId", args.playerId),
      )
      .collect();

    const hydrated = await Promise.all(
      rows.map(async (row) => {
        const season = await ctx.db.get(row.seasonId);
        return {
          row,
          seasonName: season?.name ?? "(unknown)",
          seasonStartDate: season?.startDate ?? null,
        };
      }),
    );

    hydrated.sort((a, b) => {
      const aKey = a.seasonStartDate ?? "9999";
      const bKey = b.seasonStartDate ?? "9999";
      return aKey.localeCompare(bKey);
    });

    let prevOverall: number | null = null;
    return hydrated.map(({ row, seasonName, seasonStartDate }) => {
      const overall = row.weightedOverall;
      const delta =
        overall !== null && prevOverall !== null
          ? overall - prevOverall
          : null;
      if (overall !== null) prevOverall = overall;
      return {
        id: row._id,
        seasonId: row.seasonId,
        seasonName,
        seasonStartDate,
        positionGroup: row.positionGroup,
        attributes: safeParseAttributes(row.attributesJson),
        weightedOverall: overall,
        delta,
        ingestedAt: row.ingestedAt,
      };
    });
  },
});

/*
 * Phase 3 — Fixture CRUD (Sprint 7 / WSM-000068).
 *
 * `fixtures` rows model scheduled games. The `recordGameResult`
 * mutation in WSM-000069 will flip `status` → "final"; deletion
 * cascades to the matching `gameResults` row to keep standings
 * computation honest.
 */

const fixtureDtoValidator = v.object({
  id: v.string(),
  seasonId: v.string(),
  homeTeamId: v.string(),
  awayTeamId: v.string(),
  homeTeamName: v.string(),
  awayTeamName: v.string(),
  scheduledAt: v.union(v.string(), v.null()),
  week: v.union(v.number(), v.null()),
  venue: v.union(v.string(), v.null()),
  status: v.string(),
  stage: v.string(), // "regular" | "playoff" (legacy rows = regular)
  createdAt: v.string(),
  createdBy: v.string(),
});

export const createFixture = internalMutationGeneric({
  args: {
    seasonId: v.id("seasons"),
    homeTeamId: v.id("teams"),
    awayTeamId: v.id("teams"),
    scheduledAt: v.union(v.string(), v.null()),
    week: v.union(v.number(), v.null()),
    venue: v.union(v.string(), v.null()),
    actorUserId: v.string(),
  },
  returns: fixtureDtoValidator,
  handler: async (ctx, args) => {
    if (args.homeTeamId === args.awayTeamId) {
      throw new Error("home_and_away_must_differ");
    }

    const season = await ctx.db.get(args.seasonId);
    if (!season) throw new Error("season_not_found");
    if (season.status === "completed") throw new Error("season_completed");

    const home = await ctx.db.get(args.homeTeamId);
    const away = await ctx.db.get(args.awayTeamId);
    if (!home || !away) throw new Error("team_not_found");
    if (
      home.leagueId !== season.leagueId ||
      away.leagueId !== season.leagueId
    ) {
      throw new Error("teams_outside_league");
    }

    const createdAt = new Date().toISOString();
    const id = await ctx.db.insert("fixtures", {
      seasonId: args.seasonId,
      homeTeamId: args.homeTeamId,
      awayTeamId: args.awayTeamId,
      scheduledAt: args.scheduledAt,
      week: args.week,
      venue: args.venue,
      status: "scheduled",
      createdAt,
      createdBy: args.actorUserId,
    });

    return {
      id,
      seasonId: args.seasonId,
      homeTeamId: args.homeTeamId,
      awayTeamId: args.awayTeamId,
      homeTeamName: home.name,
      awayTeamName: away.name,
      scheduledAt: args.scheduledAt,
      week: args.week,
      venue: args.venue,
      status: "scheduled",
      stage: "regular",
      createdAt,
      createdBy: args.actorUserId,
    };
  },
});

export const updateFixture = internalMutationGeneric({
  args: {
    fixtureId: v.id("fixtures"),
    scheduledAt: v.optional(v.union(v.string(), v.null())),
    week: v.optional(v.union(v.number(), v.null())),
    venue: v.optional(v.union(v.string(), v.null())),
    status: v.optional(v.string()),
  },
  returns: v.union(fixtureDtoValidator, v.null()),
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.fixtureId);
    if (!existing) return null;

    const patch: Record<string, unknown> = {};
    if (args.scheduledAt !== undefined) patch.scheduledAt = args.scheduledAt;
    if (args.week !== undefined) patch.week = args.week;
    if (args.venue !== undefined) patch.venue = args.venue;
    if (args.status !== undefined) patch.status = args.status;
    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(args.fixtureId, patch);
    }

    const merged = { ...existing, ...patch } as typeof existing;
    const home = await ctx.db.get(merged.homeTeamId);
    const away = await ctx.db.get(merged.awayTeamId);
    return {
      id: merged._id,
      seasonId: merged.seasonId,
      homeTeamId: merged.homeTeamId,
      awayTeamId: merged.awayTeamId,
      homeTeamName: home?.name ?? "(unknown)",
      awayTeamName: away?.name ?? "(unknown)",
      scheduledAt: merged.scheduledAt,
      week: merged.week,
      venue: merged.venue,
      status: merged.status,
      stage: merged.stage ?? "regular",
      createdAt: merged.createdAt,
      createdBy: merged.createdBy,
    };
  },
});

export const deleteFixture = internalMutationGeneric({
  args: { fixtureId: v.id("fixtures") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.fixtureId);
    if (!existing) return null;

    // Cascade: drop any gameResults row attached to this fixture so
    // standings computation doesn't keep counting an orphaned result.
    const results = await ctx.db
      .query("gameResults")
      .withIndex("by_fixtureId", (q) => q.eq("fixtureId", args.fixtureId))
      .collect();
    for (const r of results) {
      await ctx.db.delete(r._id);
    }

    await ctx.db.delete(args.fixtureId);
    return null;
  },
});

export const listFixturesBySeason = queryGeneric({
  args: { seasonId: v.id("seasons") },
  returns: v.array(fixtureDtoValidator),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("fixtures")
      .withIndex("by_seasonId", (q) => q.eq("seasonId", args.seasonId))
      .collect();

    return Promise.all(
      rows.map(async (row) => {
        const home = await ctx.db.get(row.homeTeamId);
        const away = await ctx.db.get(row.awayTeamId);
        return {
          id: row._id,
          seasonId: row.seasonId,
          homeTeamId: row.homeTeamId,
          awayTeamId: row.awayTeamId,
          homeTeamName: home?.name ?? "(unknown)",
          awayTeamName: away?.name ?? "(unknown)",
          scheduledAt: row.scheduledAt,
          week: row.week,
          venue: row.venue,
          status: row.status,
          stage: row.stage ?? "regular",
          createdAt: row.createdAt,
          createdBy: row.createdBy,
        };
      }),
    );
  },
});

/*
 * WSM-000153 — Generate a single round-robin schedule for a season.
 *
 * Pulls every team in the season's league and creates one fixture per pairing
 * (week numbers only; scheduledAt/venue left null for the admin to fill in).
 *
 * Regeneration guard: if fixtures already exist and any of them carry a
 * recorded result or live game state, the mutation throws `schedule_has_results`
 * unless the caller passes `confirm: true`. Otherwise existing fixtures are
 * cleared (cascading gameResults + liveGameState, mirroring deleteFixture) and
 * replaced. This keeps a re-run safe while the slate is unplayed but refuses to
 * silently orphan recorded scores.
 */
export const generateSeasonSchedule = internalMutationGeneric({
  args: {
    seasonId: v.id("seasons"),
    actorUserId: v.string(),
    confirm: v.optional(v.boolean()),
    // "single" (default) plays each pair once; "double" plays a home-and-away
    // double round-robin (WSM-000162).
    format: v.optional(v.union(v.literal("single"), v.literal("double"))),
  },
  returns: v.object({
    created: v.number(),
    weeks: v.number(),
    teamCount: v.number(),
  }),
  handler: async (ctx, args) => {
    const season = await ctx.db.get(args.seasonId);
    if (!season) throw new Error("season_not_found");
    if (season.status === "completed") throw new Error("season_completed");

    const teams = await ctx.db
      .query("teams")
      .withIndex("by_leagueId", (q) => q.eq("leagueId", season.leagueId))
      .collect();
    if (teams.length < 2) throw new Error("need_at_least_two_teams");

    const existing = await ctx.db
      .query("fixtures")
      .withIndex("by_seasonId", (q) => q.eq("seasonId", args.seasonId))
      .collect();

    // Results-guard: refuse to wipe a played/in-progress slate unless confirmed.
    if (existing.length > 0 && !args.confirm) {
      for (const f of existing) {
        const result = await ctx.db
          .query("gameResults")
          .withIndex("by_fixtureId", (q) => q.eq("fixtureId", f._id))
          .first();
        if (result) throw new Error("schedule_has_results");
        const live = await ctx.db
          .query("liveGameState")
          .withIndex("by_fixtureId", (q) => q.eq("fixtureId", f._id))
          .first();
        if (live) throw new Error("schedule_has_results");
      }
    }

    // Clear existing fixtures, cascading their results + live state.
    for (const f of existing) {
      for (const gr of await ctx.db
        .query("gameResults")
        .withIndex("by_fixtureId", (q) => q.eq("fixtureId", f._id))
        .collect())
        await ctx.db.delete(gr._id);
      for (const lg of await ctx.db
        .query("liveGameState")
        .withIndex("by_fixtureId", (q) => q.eq("fixtureId", f._id))
        .collect())
        await ctx.db.delete(lg._id);
      await ctx.db.delete(f._id);
    }

    const teamIds = teams.map((t) => t._id);
    const pairings =
      args.format === "double"
        ? doubleRoundRobinSchedule(teamIds)
        : roundRobinSchedule(teamIds);
    const createdAt = new Date().toISOString();
    for (const p of pairings) {
      await ctx.db.insert("fixtures", {
        seasonId: args.seasonId,
        homeTeamId: p.homeTeamId as Id<"teams">,
        awayTeamId: p.awayTeamId as Id<"teams">,
        // Week 1 on the season start, +7 days per week; null when the season
        // has no start date (week-numbers-only). Admins fine-tune per game.
        scheduledAt: weekKickoff(season.startDate, p.week),
        week: p.week,
        venue: null,
        status: "scheduled",
        createdAt,
        createdBy: args.actorUserId,
      });
    }

    const weeks = pairings.reduce((max, p) => Math.max(max, p.week), 0);
    return { created: pairings.length, weeks, teamCount: teams.length };
  },
});

/**
 * Player ids on a season roster. Assignment-backed leagues use
 * `rosterAssignments`; synthetic leagues (Generate rosters) store membership on
 * `players.teamId` only — fall back to active league players via `by_leagueId`.
 */
async function resolveSeasonRosterPlayerIds(
  ctx: MutationCtx,
  leagueId: Id<"leagues">,
  seasonId: Id<"seasons">,
): Promise<Id<"players">[]> {
  const assignments = await ctx.db
    .query("rosterAssignments")
    .withIndex("by_leagueId_seasonId", (q) =>
      q.eq("leagueId", leagueId).eq("seasonId", seasonId),
    )
    .collect();

  if (assignments.length > 0) {
    return [...new Set(assignments.map((a) => a.playerId))];
  }

  const players = await ctx.db
    .query("players")
    .withIndex("by_leagueId", (q) => q.eq("leagueId", leagueId))
    .collect();

  return players
    .filter((p) => p.status !== "graduated")
    .map((p) => p._id);
}

/*
 * Roster carryover (WSM-000163). Clone the previous season's rosters into a new
 * season so a coach doesn't rebuild the depth chart from scratch each year.
 *
 * Source resolution: an explicit `sourceSeasonId` (must be in the same league)
 * wins; otherwise the most recent PRIOR season in the same league — ordered by
 * `startDate` when present, else `_creationTime`, excluding the target. If none
 * exists the mutation throws `no_source_season`.
 *
 * Like generateSeasonSchedule, this refuses to silently overwrite: if the target
 * already has any rosterAssignments and the caller hasn't passed `confirm: true`,
 * it throws `target_has_rosters`. On confirm (or an empty target) it does a clean
 * replace — the target's existing rosterAssignments + depthChartEntries are
 * deleted first, then every source row is cloned into the target season.
 */
export const copySeasonRosters = internalMutation({
  args: {
    targetSeasonId: v.id("seasons"),
    sourceSeasonId: v.optional(v.id("seasons")),
    actorUserId: v.string(),
    confirm: v.optional(v.boolean()),
  },
  returns: v.object({
    copiedAssignments: v.number(),
    copiedDepthEntries: v.number(),
    sourceSeasonId: v.string(),
  }),
  handler: async (ctx, args) => {
    const target = await ctx.db.get(args.targetSeasonId);
    if (!target) throw new Error("target_season_not_found");

    // Resolve the source season.
    let source;
    if (args.sourceSeasonId) {
      source = await ctx.db.get(args.sourceSeasonId);
      if (!source) throw new Error("no_source_season");
      if (source.leagueId !== target.leagueId) {
        throw new Error("source_season_league_mismatch");
      }
      if (source._id === target._id) throw new Error("no_source_season");
    } else {
      // Most recent prior season in the same league. Prefer startDate ordering,
      // falling back to _creationTime when a season has no start date.
      const candidates = (
        await ctx.db
          .query("seasons")
          .withIndex("by_leagueId", (q) => q.eq("leagueId", target.leagueId))
          .collect()
      ).filter((s) => s._id !== target._id);
      if (candidates.length === 0) throw new Error("no_source_season");
      const sortKey = (s: (typeof candidates)[number]) =>
        s.startDate ?? new Date(s._creationTime).toISOString();
      candidates.sort((a, b) => sortKey(b).localeCompare(sortKey(a)));
      source = candidates[0];
    }

    // Load the source rows up front so the target wipe can't affect them.
    const sourceAssignments = await ctx.db
      .query("rosterAssignments")
      .withIndex("by_seasonId_teamId", (q) => q.eq("seasonId", source._id))
      .collect();
    const sourceDepthEntries = (
      await ctx.db.query("depthChartEntries").collect()
    ).filter((d) => d.seasonId === source._id);

    // Results-style guard: refuse to overwrite a populated target unconfirmed.
    const existingTargetAssignments = await ctx.db
      .query("rosterAssignments")
      .withIndex("by_seasonId_teamId", (q) =>
        q.eq("seasonId", args.targetSeasonId),
      )
      .collect();
    if (existingTargetAssignments.length > 0 && !args.confirm) {
      throw new Error("target_has_rosters");
    }

    // Synthetic leagues have no assignment/depth rows to clone; team membership
    // lives on players.teamId and persists across seasons untouched.
    if (
      sourceAssignments.length === 0 &&
      sourceDepthEntries.length === 0 &&
      existingTargetAssignments.length === 0
    ) {
      return {
        copiedAssignments: 0,
        copiedDepthEntries: 0,
        sourceSeasonId: source._id as string,
      };
    }

    // Clean replace: clear the target's existing roster + depth-chart rows.
    for (const ra of existingTargetAssignments) {
      await ctx.db.delete(ra._id);
    }
    for (const d of await ctx.db.query("depthChartEntries").collect()) {
      if (d.seasonId === args.targetSeasonId) await ctx.db.delete(d._id);
    }

    const now = new Date().toISOString();

    for (const ra of sourceAssignments) {
      await ctx.db.insert("rosterAssignments", {
        seasonId: args.targetSeasonId,
        teamId: ra.teamId,
        playerId: ra.playerId,
        leagueId: ra.leagueId,
        depthRank: ra.depthRank,
        positionSlot: ra.positionSlot,
        status: ra.status,
        assignedAt: now,
        assignedBy: args.actorUserId,
      });
    }

    for (const d of sourceDepthEntries) {
      await ctx.db.insert("depthChartEntries", {
        teamId: d.teamId,
        seasonId: args.targetSeasonId,
        playerId: d.playerId,
        positionSlot: d.positionSlot,
        sortOrder: d.sortOrder,
        updatedAt: now,
      });
    }

    return {
      copiedAssignments: sourceAssignments.length,
      copiedDepthEntries: sourceDepthEntries.length,
      sourceSeasonId: source._id as string,
    };
  },
});

const seasonPlayerAttributeRowValidator = v.object({
  playerId: v.string(),
  positionGroup: v.string(),
  attributes: v.record(v.string(), v.number()),
  weightedOverall: v.union(v.number(), v.null()),
});

/*
 * All attribute snapshots for a season (dynasty rollover / progression reads).
 * Scans each position-group bucket on the compound index — no schema change.
 */
export const listSeasonPlayerAttributes = queryGeneric({
  args: { seasonId: v.id("seasons") },
  returns: v.array(seasonPlayerAttributeRowValidator),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("playerAttributes")
      .withIndex("by_seasonId_positionGroup", (q) =>
        q.eq("seasonId", args.seasonId),
      )
      .collect();
    return rows.map((row) => ({
      playerId: row.playerId as string,
      positionGroup: row.positionGroup,
      attributes: safeParseAttributes(row.attributesJson),
      weightedOverall: row.weightedOverall,
    }));
  },
});

/*
 * Dynasty rollover (D1) — graduate seniors and advance underclassmen on the
 * active-season roster. Players with grade 12 → status "graduated"; grades
 * 9–11 → grade+1, recomputed squad, experienceYears+1.
 */
export const rolloverGraduateAndAdvancePlayers = internalMutation({
  args: {
    leagueId: v.id("leagues"),
    seasonId: v.id("seasons"),
  },
  returns: v.object({
    graduatedPlayerIds: v.array(v.string()),
    advancedPlayerIds: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    const playerIds = await resolveSeasonRosterPlayerIds(
      ctx,
      args.leagueId,
      args.seasonId,
    );
    const graduatedPlayerIds: string[] = [];
    const advancedPlayerIds: string[] = [];

    for (const playerId of playerIds) {
      const player = await ctx.db.get(playerId);
      if (!player) continue;
      const grade = player.grade ?? null;

      if (grade === 12) {
        await ctx.db.patch(playerId, { status: "graduated" });
        graduatedPlayerIds.push(playerId as string);
        continue;
      }

      if (grade !== null && grade >= 9 && grade <= 11) {
        const newGrade = grade + 1;
        await ctx.db.patch(playerId, {
          grade: newGrade,
          squad: squadForGrade(newGrade, playerId as string),
          experienceYears: (player.experienceYears ?? 0) + 1,
        });
        advancedPlayerIds.push(playerId as string);
        continue;
      }

      await ctx.db.patch(playerId, {
        experienceYears: (player.experienceYears ?? 0) + 1,
      });
      advancedPlayerIds.push(playerId as string);
    }

    return { graduatedPlayerIds, advancedPlayerIds };
  },
});

/*
 * Remove roster assignments + depth-chart rows for specific players in a season
 * (dynasty carryover cleanup after copySeasonRosters).
 */
export const removePlayersFromSeasonRoster = internalMutation({
  args: {
    leagueId: v.id("leagues"),
    seasonId: v.id("seasons"),
    playerIds: v.array(v.id("players")),
  },
  returns: v.object({
    removedAssignments: v.number(),
    removedDepthEntries: v.number(),
  }),
  handler: async (ctx, args) => {
    const target = new Set(args.playerIds.map((id) => id as string));
    let removedAssignments = 0;
    let removedDepthEntries = 0;

    const assignments = await ctx.db
      .query("rosterAssignments")
      .withIndex("by_leagueId_seasonId", (q) =>
        q.eq("leagueId", args.leagueId).eq("seasonId", args.seasonId),
      )
      .collect();
    for (const ra of assignments) {
      if (!target.has(ra.playerId as string)) continue;
      await ctx.db.delete(ra._id);
      removedAssignments += 1;
    }

    for (const d of await ctx.db.query("depthChartEntries").collect()) {
      if (d.seasonId !== args.seasonId) continue;
      if (!target.has(d.playerId as string)) continue;
      await ctx.db.delete(d._id);
      removedDepthEntries += 1;
    }

    return { removedAssignments, removedDepthEntries };
  },
});

/*
 * Offseason free agency (WSM-000231). Release sets status "free_agent" and
 * clears assignment-backed roster rows for active/upcoming seasons. teamId is
 * retained as the player's last team for pool display.
 */
export const releasePlayerToFreeAgency = internalMutation({
  args: { playerId: v.id("players") },
  returns: v.object({ playerId: v.string() }),
  handler: async (ctx, args) => {
    const player = await ctx.db.get(args.playerId);
    if (!player) throw new Error("player_not_found");
    if (player.status === "graduated") {
      throw new Error("cannot_release_graduated");
    }

    const offseasonSeasonIds = await resolveOffseasonSeasonIds(
      ctx,
      player.leagueId,
    );
    const seasonIdSet = new Set(offseasonSeasonIds.map((id) => id as string));

    const assignments = await ctx.db
      .query("rosterAssignments")
      .withIndex("by_playerId", (q) => q.eq("playerId", args.playerId))
      .collect();
    for (const ra of assignments) {
      if (!seasonIdSet.has(ra.seasonId as string)) continue;
      await ctx.db.delete(ra._id);
    }

    for (const d of await ctx.db.query("depthChartEntries").collect()) {
      if (d.playerId !== args.playerId) continue;
      if (!seasonIdSet.has(d.seasonId as string)) continue;
      await ctx.db.delete(d._id);
    }

    await ctx.db.patch(args.playerId, { status: "free_agent" });
    return { playerId: args.playerId as string };
  },
});

export const signFreeAgent = internalMutation({
  args: {
    playerId: v.id("players"),
    teamId: v.id("teams"),
    seasonId: v.id("seasons"),
    actorUserId: v.string(),
  },
  returns: v.object({
    playerId: v.string(),
    teamId: v.string(),
    overCap: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const [player, team, season] = await Promise.all([
      ctx.db.get(args.playerId),
      ctx.db.get(args.teamId),
      ctx.db.get(args.seasonId),
    ]);
    if (!player) throw new Error("player_not_found");
    if (!team) throw new Error("team_not_found");
    if (!season) throw new Error("season_not_found");
    if (player.status !== "free_agent") {
      throw new Error("player_not_free_agent");
    }
    if (team.leagueId !== season.leagueId) {
      throw new Error("team_season_league_mismatch");
    }
    if (player.leagueId !== team.leagueId) {
      throw new Error("player_league_mismatch");
    }

    const activeOnTeam = await ctx.db
      .query("players")
      .withIndex("by_teamId", (q) => q.eq("teamId", args.teamId))
      .collect();
    const activeCount = activeOnTeam.filter((p) => p.status === "active").length;
    const overCap = activeCount >= targetRosterSize();

    const positionSlot = player.position;
    await ctx.db.patch(args.playerId, {
      status: "active",
      teamId: args.teamId,
    });

    await assignPlayerToRosterCore(ctx, {
      seasonId: args.seasonId,
      teamId: args.teamId,
      playerId: args.playerId,
      positionSlot,
      actorUserId: args.actorUserId,
      enforceRosterLimit: false,
    });

    await appendDefaultDepthChartSlot(ctx, {
      teamId: args.teamId,
      seasonId: args.seasonId,
      playerId: args.playerId,
      positionSlot,
    });

    return {
      playerId: args.playerId as string,
      teamId: args.teamId as string,
      overCap,
    };
  },
});

const freeAgentDtoValidator = v.object({
  id: v.string(),
  name: v.string(),
  position: v.string(),
  grade: v.union(v.number(), v.null()),
  overall: v.union(v.number(), v.null()),
  teamId: v.string(),
});

export const listFreeAgents = queryGeneric({
  args: { leagueId: v.id("leagues") },
  returns: v.array(freeAgentDtoValidator),
  handler: async (ctx, args) => {
    const seasons = await ctx.db
      .query("seasons")
      .withIndex("by_leagueId", (q) => q.eq("leagueId", args.leagueId))
      .collect();
    const ratingSeason =
      seasons.find((s) => s.status === "upcoming") ??
      seasons.find((s) => s.status === "active") ??
      null;

    const players = await ctx.db
      .query("players")
      .withIndex("by_leagueId", (q) => q.eq("leagueId", args.leagueId))
      .collect();

    const freeAgents = players.filter((p) => p.status === "free_agent");
    const rows = await Promise.all(
      freeAgents.map(async (player) => ({
        id: player._id as string,
        name: player.name,
        position: player.position,
        grade: player.grade ?? null,
        overall: await resolvePlayerOverall(
          ctx,
          player._id,
          ratingSeason?._id ?? null,
        ),
        teamId: player.teamId as string,
      })),
    );
    return sortByName(rows);
  },
});

/* ───────────────────── Offseason draft (WSM-000233) ───────────────────── */

const DRAFT_ROUNDS = 3;

const draftPickDtoValidator = v.object({
  id: v.string(),
  round: v.number(),
  pickNumber: v.number(),
  teamId: v.string(),
  playerId: v.string(),
  madeAt: v.number(),
});

const draftDtoValidator = v.object({
  id: v.string(),
  leagueId: v.string(),
  seasonId: v.string(),
  type: v.string(),
  rounds: v.number(),
  order: v.array(v.string()),
  status: v.string(),
  currentPick: v.number(),
  onClockTeamId: v.union(v.string(), v.null()),
  picks: v.array(draftPickDtoValidator),
});

async function loadDraftPicks(
  ctx: QueryCtx | MutationCtx,
  draftId: Id<"drafts">,
) {
  return ctx.db
    .query("draftPicks")
    .withIndex("by_draftId", (q) => q.eq("draftId", draftId))
    .collect();
}

async function toDraftDto(
  ctx: QueryCtx | MutationCtx,
  draft: {
    _id: Id<"drafts">;
    leagueId: Id<"leagues">;
    seasonId: Id<"seasons">;
    type: string;
    rounds: number;
    order: Id<"teams">[];
    status: string;
    currentPick: number;
  },
) {
  const picks = await loadDraftPicks(ctx, draft._id);
  const sortedPicks = picks.sort((a, b) => a.pickNumber - b.pickNumber);
  const onClockTeamId =
    draft.status === "active"
      ? teamOnClock(
          draft.order.map((id) => id as string),
          draft.currentPick,
          draft.rounds,
        )
      : null;
  return {
    id: draft._id as string,
    leagueId: draft.leagueId as string,
    seasonId: draft.seasonId as string,
    type: draft.type,
    rounds: draft.rounds,
    order: draft.order.map((id) => id as string),
    status: draft.status,
    currentPick: draft.currentPick,
    onClockTeamId,
    picks: sortedPicks.map((p) => ({
      id: p._id as string,
      round: p.round,
      pickNumber: p.pickNumber,
      teamId: p.teamId as string,
      playerId: p.playerId as string,
      madeAt: p.madeAt,
    })),
  };
}

async function resolveStandingsSeasonForDraft(
  ctx: MutationCtx,
  leagueId: Id<"leagues">,
  draftSeasonId: Id<"seasons">,
): Promise<Id<"seasons">> {
  const seasons = await ctx.db
    .query("seasons")
    .withIndex("by_leagueId", (q) => q.eq("leagueId", leagueId))
    .collect();
  const active = seasons.find(
    (s) => s.status === "active" && s._id !== draftSeasonId,
  );
  if (active) return active._id;
  const completed = seasons
    .filter((s) => s.status === "completed" && s._id !== draftSeasonId)
    .sort((a, b) => (b.startDate ?? "").localeCompare(a.startDate ?? ""));
  if (completed[0]) return completed[0]._id;
  throw new Error("no_standings_season");
}

export const startDraft = internalMutation({
  args: {
    leagueId: v.id("leagues"),
    seasonId: v.id("seasons"),
  },
  returns: v.object({
    draftId: v.string(),
    order: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    const season = await ctx.db.get(args.seasonId);
    if (!season) throw new Error("season_not_found");
    if (season.leagueId !== args.leagueId) {
      throw new Error("league_season_mismatch");
    }

    const existing = await ctx.db
      .query("drafts")
      .withIndex("by_seasonId", (q) => q.eq("seasonId", args.seasonId))
      .first();
    if (existing) throw new Error("draft_exists");

    const freeAgents = await ctx.db
      .query("players")
      .withIndex("by_leagueId", (q) => q.eq("leagueId", args.leagueId))
      .collect();
    if (!freeAgents.some((p) => p.status === "free_agent")) {
      throw new Error("empty_pool");
    }

    const standingsSeasonId = await resolveStandingsSeasonForDraft(
      ctx,
      args.leagueId,
      args.seasonId,
    );
    const standingsSeason = await ctx.db.get(standingsSeasonId);
    if (!standingsSeason) throw new Error("no_standings_season");

    const standingOrder = await seasonStandingTeamIds(ctx, standingsSeason);
    const order = [...standingOrder].reverse() as Id<"teams">[];

    const draftId = await ctx.db.insert("drafts", {
      leagueId: args.leagueId,
      seasonId: args.seasonId,
      type: "snake",
      rounds: DRAFT_ROUNDS,
      order,
      status: "active",
      currentPick: 1,
    });

    return {
      draftId: draftId as string,
      order: order.map((id) => id as string),
    };
  },
});

export const makeDraftPick = internalMutation({
  args: {
    draftId: v.id("drafts"),
    playerId: v.id("players"),
    actorUserId: v.string(),
  },
  returns: draftDtoValidator,
  handler: async (ctx, args) => {
    const draft = await ctx.db.get(args.draftId);
    if (!draft) throw new Error("draft_not_found");
    if (draft.status !== "active") throw new Error("draft_not_active");

    const teamCount = draft.order.length;
    const totalPicks = draft.rounds * teamCount;
    if (draft.currentPick > totalPicks) throw new Error("draft_complete");

    const existingSlot = await ctx.db
      .query("draftPicks")
      .withIndex("by_draftId_pickNumber", (q) =>
        q.eq("draftId", args.draftId).eq("pickNumber", draft.currentPick),
      )
      .first();
    if (existingSlot) throw new Error("pick_already_made");

    const onClockId = teamOnClock(
      draft.order.map((id) => id as string),
      draft.currentPick,
      draft.rounds,
    );
    if (!onClockId) throw new Error("draft_complete");

    const player = await ctx.db.get(args.playerId);
    if (!player) throw new Error("player_not_found");
    if (player.status !== "free_agent") {
      throw new Error("player_not_free_agent");
    }
    if (player.leagueId !== draft.leagueId) {
      throw new Error("player_league_mismatch");
    }

    const priorPicks = await loadDraftPicks(ctx, args.draftId);
    if (priorPicks.some((p) => p.playerId === args.playerId)) {
      throw new Error("player_already_drafted");
    }

    const teamId = onClockId as Id<"teams">;
    const seasonId = draft.seasonId;
    const positionSlot = player.position;

    await ctx.db.patch(args.playerId, {
      status: "active",
      teamId,
    });

    await assignPlayerToRosterCore(ctx, {
      seasonId,
      teamId,
      playerId: args.playerId,
      positionSlot,
      actorUserId: args.actorUserId,
      enforceRosterLimit: false,
    });

    await appendDefaultDepthChartSlot(ctx, {
      teamId,
      seasonId,
      playerId: args.playerId,
      positionSlot,
    });

    const round = pickRound(draft.currentPick, teamCount);
    await ctx.db.insert("draftPicks", {
      draftId: args.draftId,
      round,
      pickNumber: draft.currentPick,
      teamId,
      playerId: args.playerId,
      madeAt: Date.now(),
    });

    const nextPick = draft.currentPick + 1;
    const isComplete = nextPick > totalPicks;
    await ctx.db.patch(args.draftId, {
      currentPick: nextPick,
      status: isComplete ? "complete" : "active",
    });

    const updated = await ctx.db.get(args.draftId);
    if (!updated) throw new Error("draft_not_found");
    return await toDraftDto(ctx, updated);
  },
});

export const endDraft = internalMutation({
  args: { draftId: v.id("drafts") },
  returns: v.object({
    draftId: v.string(),
    status: v.string(),
  }),
  handler: async (ctx, args) => {
    const draft = await ctx.db.get(args.draftId);
    if (!draft) throw new Error("draft_not_found");
    await ctx.db.patch(args.draftId, { status: "complete" });
    return { draftId: args.draftId as string, status: "complete" };
  },
});

export const getDraft = queryGeneric({
  args: { seasonId: v.id("seasons") },
  returns: v.union(draftDtoValidator, v.null()),
  handler: async (ctx, args) => {
    const draft = await ctx.db
      .query("drafts")
      .withIndex("by_seasonId", (q) => q.eq("seasonId", args.seasonId))
      .first();
    if (!draft) return null;
    return await toDraftDto(ctx, draft);
  },
});

export const getFixture = queryGeneric({
  args: { fixtureId: v.id("fixtures") },
  returns: v.union(fixtureDtoValidator, v.null()),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.fixtureId);
    if (!row) return null;
    const home = await ctx.db.get(row.homeTeamId);
    const away = await ctx.db.get(row.awayTeamId);
    return {
      id: row._id,
      seasonId: row.seasonId,
      homeTeamId: row.homeTeamId,
      awayTeamId: row.awayTeamId,
      homeTeamName: home?.name ?? "(unknown)",
      awayTeamName: away?.name ?? "(unknown)",
      scheduledAt: row.scheduledAt,
      week: row.week,
      venue: row.venue,
      status: row.status,
      stage: row.stage ?? "regular",
      createdAt: row.createdAt,
      createdBy: row.createdBy,
    };
  },
});

/*
 * Phase 3 — Game result CRUD (Sprint 7 / WSM-000069).
 *
 * Recording a result transitions the parent fixture's status to
 * "final" in the same transaction. Idempotent on `fixtureId`:
 * a re-record replaces the existing result row in place.
 */

const gameResultDtoValidator = v.object({
  id: v.string(),
  fixtureId: v.string(),
  homeScore: v.number(),
  awayScore: v.number(),
  playerStatsJson: v.union(v.string(), v.null()),
  recordedAt: v.string(),
  recordedBy: v.string(),
});

export const recordGameResult = internalMutationGeneric({
  args: {
    fixtureId: v.id("fixtures"),
    homeScore: v.number(),
    awayScore: v.number(),
    actorUserId: v.string(),
  },
  returns: gameResultDtoValidator,
  handler: async (ctx, args) => {
    const fixture = await ctx.db.get(args.fixtureId);
    if (!fixture) throw new Error("fixture_not_found");

    // Completed seasons are read-only (WSM-000217). This single gate also
    // blocks all simulation paths, which persist via recordGameResult.
    const season = await ctx.db.get(fixture.seasonId);
    if (season?.status === "completed") throw new Error("season_completed");

    const recordedAt = new Date().toISOString();
    const payload = {
      fixtureId: args.fixtureId,
      homeScore: args.homeScore,
      awayScore: args.awayScore,
      playerStatsJson: null,
      recordedAt,
      recordedBy: args.actorUserId,
    };

    const existing = await ctx.db
      .query("gameResults")
      .withIndex("by_fixtureId", (q) => q.eq("fixtureId", args.fixtureId))
      .first();

    let resultId: string;
    if (existing) {
      await ctx.db.replace(existing._id, payload);
      resultId = existing._id;
    } else {
      resultId = await ctx.db.insert("gameResults", payload);
    }

    if (fixture.status !== "final") {
      await ctx.db.patch(args.fixtureId, { status: "final" });
    }

    // Playoff games advance the winner up the bracket atomically with the
    // result (WSM-000164). Idempotent: re-recording recomputes the same tree.
    if (fixture.stage === "playoff") {
      await advanceBracketForSeason(ctx as MutationCtx, fixture.seasonId);
    }

    return {
      id: resultId,
      fixtureId: args.fixtureId,
      homeScore: args.homeScore,
      awayScore: args.awayScore,
      playerStatsJson: null,
      recordedAt,
      recordedBy: args.actorUserId,
    };
  },
});

export const getResultByFixture = queryGeneric({
  args: { fixtureId: v.id("fixtures") },
  returns: v.union(gameResultDtoValidator, v.null()),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("gameResults")
      .withIndex("by_fixtureId", (q) => q.eq("fixtureId", args.fixtureId))
      .first();
    if (!row) return null;
    return {
      id: row._id,
      fixtureId: row.fixtureId,
      homeScore: row.homeScore,
      awayScore: row.awayScore,
      playerStatsJson: row.playerStatsJson,
      recordedAt: row.recordedAt,
      recordedBy: row.recordedBy,
    };
  },
});

/*
 * Batch results for a whole season in ONE query (WSM-000193).
 *
 * The dashboard used to call `getResultByFixture` once per fixture — an N+1 that
 * fired ~one Convex function call per game per render (90+ for a full season),
 * the dominant driver of prod function-call volume. This collapses that fan-out
 * to a single call: the per-fixture `gameResults` lookups now happen as in-process
 * DB reads inside one invocation (same pattern `computeStandings` already uses).
 *
 * Returns a SCORE-ONLY projection (no `playerStatsJson`) — the dashboard needs
 * only scores keyed by fixture, and omitting the stats blob keeps the array
 * payload small even for a fully stat-kept season.
 */
const seasonResultValidator = v.object({
  fixtureId: v.string(),
  homeScore: v.number(),
  awayScore: v.number(),
});

export const listResultsBySeason = queryGeneric({
  args: { seasonId: v.id("seasons") },
  returns: v.array(seasonResultValidator),
  handler: async (ctx, args) => {
    const fixtures = await ctx.db
      .query("fixtures")
      .withIndex("by_seasonId", (q) => q.eq("seasonId", args.seasonId))
      .collect();
    const rows = await Promise.all(
      fixtures.map((f) =>
        ctx.db
          .query("gameResults")
          .withIndex("by_fixtureId", (q) => q.eq("fixtureId", f._id))
          .first(),
      ),
    );
    return rows
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .map((r) => ({
        fixtureId: r.fixtureId,
        homeScore: r.homeScore,
        awayScore: r.awayScore,
      }));
  },
});

/*
 * Phase 3 — Standings compute (Sprint 7 / WSM-000070).
 *
 * Pure math lives in `convex/lib/standings.ts`. The queries below
 * just hydrate `teams` + `fixtures` + `gameResults` for the season
 * and delegate. Computed-on-read; no derived table.
 */

const standingValidator = v.object({
  teamId: v.string(),
  teamName: v.string(),
  wins: v.number(),
  losses: v.number(),
  ties: v.number(),
  pointsFor: v.number(),
  pointsAgainst: v.number(),
  divisionRank: v.number(),
  leagueRank: v.number(),
});

export const computeStandings = query({
  args: { seasonId: v.id("seasons") },
  returns: v.array(standingValidator),
  handler: async (ctx, args) => {
    const season = await ctx.db.get(args.seasonId);
    if (!season) return [];

    const teamRows = await ctx.db
      .query("teams")
      .withIndex("by_leagueId", (q) => q.eq("leagueId", season.leagueId))
      .collect();

    const fixtureRows = await ctx.db
      .query("fixtures")
      .withIndex("by_seasonId", (q) => q.eq("seasonId", args.seasonId))
      .collect();

    const finalFixtureIds = fixtureRows
      .filter((f) => f.status === "final" && f.stage !== "playoff")
      .map((f) => f._id);

    const resultRows = (
      await Promise.all(
        finalFixtureIds.map((fid) =>
          ctx.db
            .query("gameResults")
            .withIndex("by_fixtureId", (q) => q.eq("fixtureId", fid))
            .first(),
        ),
      )
    ).filter((r): r is NonNullable<typeof r> => r !== null);

    return computeStandingsPure({
      teams: teamRows.map((t) => ({
        _id: t._id,
        name: t.name,
        divisionId: t.divisionId,
      })),
      fixtures: fixtureRows
        .filter((f) => f.stage !== "playoff")
        .map((f) => ({
          _id: f._id,
          seasonId: f.seasonId,
          homeTeamId: f.homeTeamId,
          awayTeamId: f.awayTeamId,
          status: f.status,
        })),
      results: resultRows.map((r) => ({
        fixtureId: r.fixtureId,
        homeScore: r.homeScore,
        awayScore: r.awayScore,
      })),
    });
  },
});

export const computeDivisionStandings = query({
  args: {
    seasonId: v.id("seasons"),
    divisionId: v.id("divisions"),
  },
  returns: v.array(standingValidator),
  handler: async (ctx, args) => {
    const season = await ctx.db.get(args.seasonId);
    if (!season) return [];

    const teamRows = await ctx.db
      .query("teams")
      .withIndex("by_leagueId", (q) => q.eq("leagueId", season.leagueId))
      .collect();

    const fixtureRows = await ctx.db
      .query("fixtures")
      .withIndex("by_seasonId", (q) => q.eq("seasonId", args.seasonId))
      .collect();

    const finalFixtureIds = fixtureRows
      .filter((f) => f.status === "final" && f.stage !== "playoff")
      .map((f) => f._id);

    const resultRows = (
      await Promise.all(
        finalFixtureIds.map((fid) =>
          ctx.db
            .query("gameResults")
            .withIndex("by_fixtureId", (q) => q.eq("fixtureId", fid))
            .first(),
        ),
      )
    ).filter((r): r is NonNullable<typeof r> => r !== null);

    return computeStandingsPure({
      teams: teamRows.map((t) => ({
        _id: t._id,
        name: t.name,
        divisionId: t.divisionId,
      })),
      fixtures: fixtureRows
        .filter((f) => f.stage !== "playoff")
        .map((f) => ({
          _id: f._id,
          seasonId: f.seasonId,
          homeTeamId: f.homeTeamId,
          awayTeamId: f.awayTeamId,
          status: f.status,
        })),
      results: resultRows.map((r) => ({
        fixtureId: r.fixtureId,
        homeScore: r.homeScore,
        awayScore: r.awayScore,
      })),
      divisionFilter: args.divisionId,
    });
  },
});

/*
 * Phase 3 — Public standings (Sprint 7 / WSM-000073).
 *
 * Returns null when the league isn't opt-in public OR has no seasons.
 * Layered defense alongside the page-level `publicLeagueGuard`.
 */

export const computeStandingsPublic = query({
  args: { leagueId: v.id("leagues") },
  returns: v.union(
    v.object({
      seasonName: v.string(),
      rows: v.array(standingValidator),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const league = await ctx.db.get(args.leagueId);
    if (!league || !league.isPublic) return null;

    const seasonRows = await ctx.db
      .query("seasons")
      .withIndex("by_leagueId", (q) => q.eq("leagueId", args.leagueId))
      .collect();
    if (seasonRows.length === 0) return null;

    const activeSeason =
      seasonRows.find((s) => s.status === "active") ?? seasonRows[0];

    const teamRows = await ctx.db
      .query("teams")
      .withIndex("by_leagueId", (q) => q.eq("leagueId", args.leagueId))
      .collect();

    const fixtureRows = await ctx.db
      .query("fixtures")
      .withIndex("by_seasonId", (q) => q.eq("seasonId", activeSeason._id))
      .collect();

    const finalFixtureIds = fixtureRows
      .filter((f) => f.status === "final" && f.stage !== "playoff")
      .map((f) => f._id);

    const resultRows = (
      await Promise.all(
        finalFixtureIds.map((fid) =>
          ctx.db
            .query("gameResults")
            .withIndex("by_fixtureId", (q) => q.eq("fixtureId", fid))
            .first(),
        ),
      )
    ).filter((r): r is NonNullable<typeof r> => r !== null);

    const rows = computeStandingsPure({
      teams: teamRows.map((t) => ({
        _id: t._id,
        name: t.name,
        divisionId: t.divisionId,
      })),
      fixtures: fixtureRows
        .filter((f) => f.stage !== "playoff")
        .map((f) => ({
          _id: f._id,
          seasonId: f.seasonId,
          homeTeamId: f.homeTeamId,
          awayTeamId: f.awayTeamId,
          status: f.status,
        })),
      results: resultRows.map((r) => ({
        fixtureId: r.fixtureId,
        homeScore: r.homeScore,
        awayScore: r.awayScore,
      })),
    });

    return { seasonName: activeSeason.name, rows };
  },
});

/*
 * Phase 1 live game streaming (WSM-000144, streaming epic #225).
 *
 * One Mux live stream per fixture. The stream KEY is never persisted (Mux holds
 * it; the server action returns it in-memory to the starting admin only). Writes
 * are internalMutation — only trusted server code (data-api.ts holding the admin
 * key) can call them. The public read projects to public fields ONLY, so the Mux
 * live-stream id (server-side) and key never transit a public query.
 */

// Public projection — what an unauthenticated viewer is allowed to see.
// Provider-agnostic (WSM-000180): a viewer gets the public playback id for
// whichever provider backs the stream, never the Mux live-stream id.
const publicStreamDtoValidator = v.union(
  v.object({
    status: v.string(),
    provider: v.string(), // "mux" | "youtube"
    muxPlaybackId: v.union(v.string(), v.null()),
    youtubeVideoId: v.union(v.string(), v.null()),
    vodAssetId: v.union(v.string(), v.null()),
    // Public playback id of the recorded asset — what a replay actually plays
    // (WSM-000198). Distinct from muxPlaybackId, which serves the live edge.
    vodPlaybackId: v.union(v.string(), v.null()),
  }),
  v.null(),
);

export const createGameStream = internalMutationGeneric({
  args: {
    fixtureId: v.id("fixtures"),
    provider: v.optional(v.string()), // "mux" (default) | "youtube"
    muxLiveStreamId: v.optional(v.string()),
    muxPlaybackId: v.optional(v.string()),
    youtubeVideoId: v.optional(v.union(v.string(), v.null())),
    latencyMode: v.optional(v.string()), // "low" | "standard" (mux only)
    startedBy: v.string(),
    maxDurationMinutes: v.number(),
  },
  returns: v.object({
    id: v.string(),
    fixtureId: v.string(),
    status: v.string(),
  }),
  handler: async (ctx, args) => {
    const fixture = await ctx.db.get(args.fixtureId);
    if (!fixture) throw new Error("fixture_not_found");

    const provider = args.provider ?? "mux";
    const payload = {
      fixtureId: args.fixtureId,
      provider,
      muxLiveStreamId: args.muxLiveStreamId,
      muxPlaybackId: args.muxPlaybackId,
      youtubeVideoId: args.youtubeVideoId ?? null,
      latencyMode: args.latencyMode,
      // A pasted YouTube link is already live, so it starts "active"; Mux waits
      // for its webhook (video.live_stream.active) to confirm before flipping.
      status: provider === "youtube" ? "active" : "idle",
      vodAssetId: null,
      vodPlaybackId: null,
      startedBy: args.startedBy,
      startedAt: new Date().toISOString(),
      endedAt: null,
      maxDurationMinutes: args.maxDurationMinutes,
    };

    // One stream per fixture: replace any prior (e.g. ended) stream in place so
    // a coach can re-go-live on the same game.
    const existing = await ctx.db
      .query("gameStreams")
      .withIndex("by_fixtureId", (q) => q.eq("fixtureId", args.fixtureId))
      .first();

    let id: string;
    if (existing) {
      await ctx.db.replace(existing._id, payload);
      id = existing._id;
    } else {
      id = await ctx.db.insert("gameStreams", payload);
    }

    return {
      id,
      fixtureId: args.fixtureId,
      status: payload.status,
    };
  },
});

/*
 * Manual end-by-fixture (WSM-000180) — used to stop a YouTube stream, which has
 * no Mux webhook to flip it. Provider-agnostic and idempotent.
 */
export const endGameStreamByFixture = internalMutationGeneric({
  args: { fixtureId: v.id("fixtures"), endedAt: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("gameStreams")
      .withIndex("by_fixtureId", (q) => q.eq("fixtureId", args.fixtureId))
      .first();
    if (!row) return false;
    await ctx.db.patch(row._id, { status: "ended", endedAt: args.endedAt });
    return true;
  },
});

export const updateGameStreamStatus = internalMutationGeneric({
  args: {
    muxLiveStreamId: v.string(),
    // Optional so a `video.asset.ready` webhook can attach the VOD ids without
    // changing status (status flips separately on live_stream.idle).
    status: v.optional(v.string()),
    vodAssetId: v.optional(v.union(v.string(), v.null())),
    vodPlaybackId: v.optional(v.union(v.string(), v.null())),
    endedAt: v.optional(v.union(v.string(), v.null())),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("gameStreams")
      .withIndex("by_muxLiveStreamId", (q) =>
        q.eq("muxLiveStreamId", args.muxLiveStreamId),
      )
      .first();
    // Idempotent: an unknown stream id (or a duplicate webhook delivery) is a
    // no-op, not an error — Mux retries on non-2xx and may deliver out of order.
    if (!row) return false;

    const patch: {
      status?: string;
      vodAssetId?: string | null;
      vodPlaybackId?: string | null;
      endedAt?: string | null;
    } = {};
    if (args.status !== undefined) patch.status = args.status;
    if (args.vodAssetId !== undefined) patch.vodAssetId = args.vodAssetId;
    if (args.vodPlaybackId !== undefined)
      patch.vodPlaybackId = args.vodPlaybackId;
    if (args.endedAt !== undefined) patch.endedAt = args.endedAt;

    await ctx.db.patch(row._id, patch);
    return true;
  },
});

export const getStreamByFixture = queryGeneric({
  args: { fixtureId: v.id("fixtures") },
  returns: publicStreamDtoValidator,
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("gameStreams")
      .withIndex("by_fixtureId", (q) => q.eq("fixtureId", args.fixtureId))
      .first();
    if (!row) return null;
    // PUBLIC PROJECTION ONLY — never return muxLiveStreamId (server-side) here.
    return {
      status: row.status,
      provider: row.provider ?? "mux",
      muxPlaybackId: row.muxPlaybackId ?? null,
      youtubeVideoId: row.youtubeVideoId ?? null,
      vodAssetId: row.vodAssetId,
      vodPlaybackId: row.vodPlaybackId ?? null,
    };
  },
});

/*
 * INTERNAL read — returns the server-side Mux live-stream id for a fixture so a
 * trusted server action (holding the admin key) can disable/transition it. This
 * is internalQueryGeneric, so it is NOT on the public `api` object and can never
 * be called by an anonymous client — that's why it's allowed to expose the
 * live-stream id (which getStreamByFixture intentionally hides from the public).
 */
export const getStreamAdminByFixture = internalQueryGeneric({
  args: { fixtureId: v.id("fixtures") },
  returns: v.union(
    v.object({
      provider: v.string(),
      muxLiveStreamId: v.union(v.string(), v.null()),
      status: v.string(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("gameStreams")
      .withIndex("by_fixtureId", (q) => q.eq("fixtureId", args.fixtureId))
      .first();
    if (!row) return null;
    return {
      provider: row.provider ?? "mux",
      muxLiveStreamId: row.muxLiveStreamId ?? null,
      status: row.status,
    };
  },
});

export const getActiveStreamCountForLeague = queryGeneric({
  args: { leagueId: v.id("leagues") },
  returns: v.number(),
  handler: async (ctx, args) => {
    const active = await ctx.db
      .query("gameStreams")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();

    let count = 0;
    for (const stream of active) {
      const fixture = await ctx.db.get(stream.fixtureId);
      if (!fixture) continue;
      const season = await ctx.db.get(fixture.seasonId);
      if (season && season.leagueId === args.leagueId) count += 1;
    }
    return count;
  },
});

/*
 * Highlight clips (WSM-000201, #303 track 3). A clip is its own Mux asset cut
 * from the stream's VOD recording. Writes are internalMutation (trusted server
 * code only); the public read lists READY clips projected to playback-only
 * fields — the clip's Mux asset id never transits a public query, mirroring
 * how gameStreams hides the live-stream id.
 */

export const createGameClip = internalMutationGeneric({
  args: {
    fixtureId: v.id("fixtures"),
    muxAssetId: v.string(),
    playbackId: v.union(v.string(), v.null()),
    label: v.string(),
    startTime: v.number(),
    endTime: v.number(),
    createdBy: v.string(),
  },
  returns: v.object({ id: v.string() }),
  handler: async (ctx, args) => {
    const fixture = await ctx.db.get(args.fixtureId);
    if (!fixture) throw new Error("fixture_not_found");
    const id = await ctx.db.insert("gameClips", {
      fixtureId: args.fixtureId,
      muxAssetId: args.muxAssetId,
      playbackId: args.playbackId,
      label: args.label,
      startTime: args.startTime,
      endTime: args.endTime,
      status: "preparing",
      createdBy: args.createdBy,
      createdAt: new Date().toISOString(),
    });
    return { id };
  },
});

export const updateGameClipStatus = internalMutationGeneric({
  args: {
    muxAssetId: v.string(),
    status: v.string(), // "ready" | "errored"
    playbackId: v.optional(v.union(v.string(), v.null())),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("gameClips")
      .withIndex("by_muxAssetId", (q) => q.eq("muxAssetId", args.muxAssetId))
      .first();
    // Idempotent: an unknown asset id (e.g. a late event for a clip deleted
    // meanwhile, or a duplicate delivery) is a no-op, not an error.
    if (!row) return false;
    const patch: { status: string; playbackId?: string | null } = {
      status: args.status,
    };
    if (args.playbackId !== undefined) patch.playbackId = args.playbackId;
    await ctx.db.patch(row._id, patch);
    return true;
  },
});

export const deleteGameClip = internalMutationGeneric({
  args: { clipId: v.id("gameClips"), fixtureId: v.id("fixtures") },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.clipId);
    // The fixture check pins the delete to the fixture the caller was
    // authorized for — a clip id from another game can't be deleted sideways.
    if (!row || row.fixtureId !== args.fixtureId) return false;
    await ctx.db.delete(args.clipId);
    return true;
  },
});

// Public projection — READY clips only, playback fields only.
export const listClipsByFixture = queryGeneric({
  args: { fixtureId: v.id("fixtures") },
  returns: v.array(
    v.object({
      playbackId: v.string(),
      label: v.string(),
      createdAt: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("gameClips")
      .withIndex("by_fixtureId", (q) => q.eq("fixtureId", args.fixtureId))
      .collect();
    // PUBLIC PROJECTION ONLY — never return muxAssetId here.
    return rows
      .filter((r) => r.status === "ready" && r.playbackId)
      .map((r) => ({
        playbackId: r.playbackId as string,
        label: r.label,
        createdAt: r.createdAt,
      }));
  },
});

/*
 * INTERNAL read — full clip rows (incl. the Mux asset id + status) for the
 * admin-keyed server: the clips dialog also lists preparing/errored clips, and
 * deleting a clip needs its asset id to tear down the Mux asset.
 */
export const listClipsAdminByFixture = internalQueryGeneric({
  args: { fixtureId: v.id("fixtures") },
  returns: v.array(
    v.object({
      id: v.string(),
      muxAssetId: v.string(),
      playbackId: v.union(v.string(), v.null()),
      label: v.string(),
      startTime: v.number(),
      endTime: v.number(),
      status: v.string(),
      createdAt: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("gameClips")
      .withIndex("by_fixtureId", (q) => q.eq("fixtureId", args.fixtureId))
      .collect();
    return rows.map((r) => ({
      id: r._id,
      muxAssetId: r.muxAssetId,
      playbackId: r.playbackId,
      label: r.label,
      startTime: r.startTime,
      endTime: r.endTime,
      status: r.status,
      createdAt: r.createdAt,
    }));
  },
});

/*
 * Stat-keeping keystone (WSM-000112) — per-player box-score lines.
 *
 * Writes are internalMutation (only the admin-keyed server reaches them). One
 * row per (fixture, player); `statsJson` is the typed box-score line validated
 * at the edge before it gets here. Season totals are computed-on-read by
 * aggregating a player's rows (pure helper in lib/playerStats.ts).
 */

const playerGameStatsRowValidator = v.object({
  id: v.string(),
  fixtureId: v.string(),
  playerId: v.string(),
  teamId: v.string(),
  seasonId: v.string(),
  statsJson: v.string(),
  enteredBy: v.string(),
  updatedAt: v.string(),
});

export const upsertPlayerGameStats = internalMutation({
  args: {
    fixtureId: v.id("fixtures"),
    playerId: v.id("players"),
    teamId: v.id("teams"),
    seasonId: v.id("seasons"),
    statsJson: v.string(),
    actorUserId: v.string(),
  },
  returns: v.object({ id: v.string() }),
  handler: async (ctx, args) => {
    const fixture = await ctx.db.get(args.fixtureId);
    if (!fixture) throw new Error("fixture_not_found");

    const payload = {
      fixtureId: args.fixtureId,
      playerId: args.playerId,
      teamId: args.teamId,
      seasonId: args.seasonId,
      statsJson: args.statsJson,
      enteredBy: args.actorUserId,
      updatedAt: new Date().toISOString(),
    };

    // One row per (fixture, player) — re-entry replaces the line in place.
    const existing = await ctx.db
      .query("playerGameStats")
      .withIndex("by_fixtureId_playerId", (q) =>
        q.eq("fixtureId", args.fixtureId).eq("playerId", args.playerId),
      )
      .first();

    let id: string;
    if (existing) {
      await ctx.db.replace(existing._id, payload);
      id = existing._id;
    } else {
      id = await ctx.db.insert("playerGameStats", payload);
    }
    return { id };
  },
});

const bulkStatLineValidator = v.object({
  playerId: v.id("players"),
  teamId: v.id("teams"),
  statsJson: v.string(),
});

export const bulkUpsertPlayerGameStats = internalMutation({
  args: {
    fixtureId: v.id("fixtures"),
    seasonId: v.id("seasons"),
    actorUserId: v.string(),
    lines: v.array(bulkStatLineValidator),
  },
  returns: v.object({ upserted: v.number() }),
  handler: async (ctx, args) => {
    const fixture = await ctx.db.get(args.fixtureId);
    if (!fixture) throw new Error("fixture_not_found");

    const updatedAt = new Date().toISOString();
    let upserted = 0;

    for (const line of args.lines) {
      const payload = {
        fixtureId: args.fixtureId,
        playerId: line.playerId,
        teamId: line.teamId,
        seasonId: args.seasonId,
        statsJson: line.statsJson,
        enteredBy: args.actorUserId,
        updatedAt,
      };

      const existing = await ctx.db
        .query("playerGameStats")
        .withIndex("by_fixtureId_playerId", (q) =>
          q.eq("fixtureId", args.fixtureId).eq("playerId", line.playerId),
        )
        .first();

      if (existing) {
        await ctx.db.replace(existing._id, payload);
      } else {
        await ctx.db.insert("playerGameStats", payload);
      }
      upserted += 1;
    }

    return { upserted };
  },
});

const gamePlayLogDtoValidator = v.object({
  fixtureId: v.string(),
  seasonId: v.string(),
  logJson: v.string(),
  engineVersion: v.string(),
  createdAt: v.string(),
  createdBy: v.string(),
});

export const upsertGamePlayLog = internalMutation({
  args: {
    fixtureId: v.id("fixtures"),
    seasonId: v.id("seasons"),
    logJson: v.string(),
    engineVersion: v.string(),
    actorUserId: v.string(),
  },
  returns: v.object({ id: v.string() }),
  handler: async (ctx, args) => {
    const fixture = await ctx.db.get(args.fixtureId);
    if (!fixture) throw new Error("fixture_not_found");

    const createdAt = new Date().toISOString();
    const payload = {
      fixtureId: args.fixtureId,
      seasonId: args.seasonId,
      logJson: args.logJson,
      engineVersion: args.engineVersion,
      createdAt,
      createdBy: args.actorUserId,
    };

    const existing = await ctx.db
      .query("gamePlayLogs")
      .withIndex("by_fixtureId", (q) => q.eq("fixtureId", args.fixtureId))
      .first();

    let id: string;
    if (existing) {
      await ctx.db.replace(existing._id, payload);
      id = existing._id;
    } else {
      id = await ctx.db.insert("gamePlayLogs", payload);
    }
    return { id };
  },
});

export const getGamePlayLog = query({
  args: { fixtureId: v.id("fixtures") },
  returns: v.union(gamePlayLogDtoValidator, v.null()),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("gamePlayLogs")
      .withIndex("by_fixtureId", (q) => q.eq("fixtureId", args.fixtureId))
      .first();
    if (!row) return null;
    return {
      fixtureId: row.fixtureId,
      seasonId: row.seasonId,
      logJson: row.logJson,
      engineVersion: row.engineVersion,
      createdAt: row.createdAt,
      createdBy: row.createdBy,
    };
  },
});

export const deletePlayerGameStats = internalMutation({
  args: { fixtureId: v.id("fixtures"), playerId: v.id("players") },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("playerGameStats")
      .withIndex("by_fixtureId_playerId", (q) =>
        q.eq("fixtureId", args.fixtureId).eq("playerId", args.playerId),
      )
      .first();
    if (!row) return false;
    await ctx.db.delete(row._id);
    return true;
  },
});

export const getPlayerGameStatsByFixture = query({
  args: { fixtureId: v.id("fixtures") },
  returns: v.array(playerGameStatsRowValidator),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("playerGameStats")
      .withIndex("by_fixtureId", (q) => q.eq("fixtureId", args.fixtureId))
      .collect();
    return rows.map((r) => ({
      id: r._id,
      fixtureId: r.fixtureId,
      playerId: r.playerId,
      teamId: r.teamId,
      seasonId: r.seasonId,
      statsJson: r.statsJson,
      enteredBy: r.enteredBy,
      updatedAt: r.updatedAt,
    }));
  },
});

export const getPlayerSeasonTotals = query({
  args: { playerId: v.id("players"), seasonId: v.id("seasons") },
  returns: v.object({ statsJson: v.string(), gameCount: v.number() }),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("playerGameStats")
      .withIndex("by_playerId_seasonId", (q) =>
        q.eq("playerId", args.playerId).eq("seasonId", args.seasonId),
      )
      .collect();
    const totals = aggregateStatLines(rows.map((r) => parseStatLine(r.statsJson)));
    return { statsJson: JSON.stringify(totals), gameCount: rows.length };
  },
});

/*
 * HS SPRT ratings for a season, computed on-read from entered game stats
 * (WSM-000112, PR5). Aggregates each player's playerGameStats rows, maps their
 * roster position to a rating group, and z-scores within the season cohort (see
 * lib/hsSprt.ts). Returns only qualified, rated players — a player profile picks
 * its own id out of the list. Public read (allow-listed in the #210 backstop).
 */
export const computeSeasonSprt = query({
  args: { seasonId: v.id("seasons") },
  returns: v.array(
    v.object({
      playerId: v.string(),
      positionGroup: v.string(),
      overall: v.number(),
      attributesJson: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("playerGameStats")
      .withIndex("by_seasonId", (q) => q.eq("seasonId", args.seasonId))
      .collect();

    const byPlayer = new Map<string, string[]>();
    for (const r of rows) {
      const arr = byPlayer.get(r.playerId) ?? [];
      arr.push(r.statsJson);
      byPlayer.set(r.playerId, arr);
    }

    const inputs: HsRatingInput[] = [];
    for (const [playerId, jsons] of byPlayer) {
      const player = await ctx.db.get(playerId as Id<"players">);
      if (!player) continue;
      const group = positionToRatingGroup(player.position);
      if (!group) continue;
      inputs.push({
        id: playerId,
        group,
        totals: aggregateStatLines(jsons.map(parseStatLine)),
        games: jsons.length,
      });
    }

    const ratings = computeHsSprtRatings(inputs);
    const out: Array<{
      playerId: string;
      positionGroup: string;
      overall: number;
      attributesJson: string;
    }> = [];
    for (const [playerId, r] of ratings) {
      out.push({
        playerId,
        positionGroup: r.positionGroup,
        overall: r.overall,
        attributesJson: JSON.stringify(r.attributes),
      });
    }
    return out;
  },
});

/*
 * Season stat-leaders (WSM-000186) — top players per category for a season,
 * computed on-read from entered game stats. Aggregates each player's lines,
 * flattens to leaderboard scalars, and ranks (see lib/statLeaders.ts). Called
 * server-side (admin-keyed) by the dashboard league stats page.
 */
const statLeadersValidator = v.array(
  v.object({
    key: v.string(),
    label: v.string(),
    leaders: v.array(
      v.object({
        playerId: v.string(),
        playerName: v.string(),
        teamName: v.string(),
        jerseyNumber: v.union(v.number(), v.null()),
        value: v.number(),
      }),
    ),
  }),
);

/** Shared: compute a season's ranked stat-leaders from entered game stats. */
async function seasonStatLeaders(
  ctx: QueryCtx,
  seasonId: Id<"seasons">,
): Promise<ReturnType<typeof computeStatLeaders>> {
  const rows = await ctx.db
    .query("playerGameStats")
    .withIndex("by_seasonId", (q) => q.eq("seasonId", seasonId))
    .collect();

  const byPlayer = new Map<string, string[]>();
  for (const r of rows) {
    const arr = byPlayer.get(r.playerId) ?? [];
    arr.push(r.statsJson);
    byPlayer.set(r.playerId, arr);
  }

  const players: LeaderInput[] = [];
  for (const [playerId, jsons] of byPlayer) {
    const totals = aggregateStatLines(jsons.map(parseStatLine));
    const values = categoryValues(totals);
    // Skip players with no leaderboard-relevant stats this season.
    if (Object.values(values).every((v2) => v2 === 0)) continue;
    const player = await ctx.db.get(playerId as Id<"players">);
    if (!player) continue;
    const team = await ctx.db.get(player.teamId);
    players.push({
      playerId,
      playerName: player.name,
      teamName: team?.name ?? "(unknown)",
      jerseyNumber: player.jerseyNumber ?? null,
      values,
    });
  }

  return computeStatLeaders(players, 5);
}

export const getSeasonStatLeaders = query({
  args: { seasonId: v.id("seasons") },
  returns: statLeadersValidator,
  handler: async (ctx, args) => seasonStatLeaders(ctx, args.seasonId),
});

/*
 * Public stat-leaders (WSM-000186) — fan-facing, NO Clerk session. Re-checks
 * `league.isPublic` here (defense in depth, mirroring computeStandingsPublic)
 * so a stale/skipped middleware can't leak a private league's data, and
 * resolves the season internally. Null when the league isn't public or has no
 * season.
 */
export const getSeasonStatLeadersPublic = query({
  args: { leagueId: v.id("leagues") },
  returns: v.union(
    v.object({ seasonName: v.string(), categories: statLeadersValidator }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const league = await ctx.db.get(args.leagueId);
    if (!league || !league.isPublic) return null;

    const seasonRows = await ctx.db
      .query("seasons")
      .withIndex("by_leagueId", (q) => q.eq("leagueId", args.leagueId))
      .collect();
    if (seasonRows.length === 0) return null;
    const activeSeason =
      seasonRows.find((s) => s.status === "active") ?? seasonRows[0];

    return {
      seasonName: activeSeason.name,
      categories: await seasonStatLeaders(ctx, activeSeason._id),
    };
  },
});

/*
 * Admin-auth probe (WSM-000151). A no-op internalQuery — callable only by an
 * admin-keyed client. /api/health calls it through getConvexClient to verify
 * CONVEX_ADMIN_KEY actually authenticates as admin, so a misconfigured key
 * fails the health check loudly instead of silently breaking writes while
 * public reads keep working (the WSM-000150 failure mode). internalQuery → not
 * on the public api, so no #210 allow-list change.
 */
export const adminPing = internalQueryGeneric({
  args: {},
  returns: v.boolean(),
  handler: async () => true,
});

/*
 * Live game-state — keystone v3 (WSM-000152). One row per fixture; an operator
 * drives the running scoreboard. Writes are internalMutation (admin-keyed server
 * actions only); getLiveGameState is the PUBLIC projected read that the
 * streaming live-score overlay (#302) and the public game page poll. Ending the
 * game writes the final to gameResults (standings) the same way recordGameResult
 * does, and flips the fixture to "final".
 */

const liveStateDtoValidator = v.object({
  id: v.string(),
  fixtureId: v.string(),
  homeScore: v.number(),
  awayScore: v.number(),
  period: v.number(),
  clock: v.union(v.string(), v.null()),
  status: v.string(),
  startedBy: v.string(),
  startedAt: v.string(),
  updatedAt: v.string(),
});

type LiveRow = {
  _id: string;
  fixtureId: string;
  homeScore: number;
  awayScore: number;
  period: number;
  clock: string | null;
  status: string;
  startedBy: string;
  startedAt: string;
  updatedAt: string;
};

function toLiveDto(row: LiveRow) {
  return {
    id: row._id,
    fixtureId: row.fixtureId,
    homeScore: row.homeScore,
    awayScore: row.awayScore,
    period: row.period,
    clock: row.clock,
    status: row.status,
    startedBy: row.startedBy,
    startedAt: row.startedAt,
    updatedAt: row.updatedAt,
  };
}

export const startLiveGame = internalMutation({
  args: { fixtureId: v.id("fixtures"), actorUserId: v.string() },
  returns: liveStateDtoValidator,
  handler: async (ctx, args) => {
    const fixture = await ctx.db.get(args.fixtureId);
    if (!fixture) throw new Error("fixture_not_found");

    const now = new Date().toISOString();
    const payload = {
      fixtureId: args.fixtureId,
      homeScore: 0,
      awayScore: 0,
      period: 1,
      clock: null,
      status: "in_progress",
      startedBy: args.actorUserId,
      startedAt: now,
      updatedAt: now,
    };
    const existing = await ctx.db
      .query("liveGameState")
      .withIndex("by_fixtureId", (q) => q.eq("fixtureId", args.fixtureId))
      .first();
    let id: string;
    if (existing) {
      await ctx.db.replace(existing._id, payload); // restart resets the board
      id = existing._id;
    } else {
      id = await ctx.db.insert("liveGameState", payload);
    }
    return toLiveDto({ _id: id, ...payload });
  },
});

export const addLiveScore = internalMutation({
  args: {
    fixtureId: v.id("fixtures"),
    team: v.union(v.literal("home"), v.literal("away")),
    points: v.number(),
  },
  returns: liveStateDtoValidator,
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("liveGameState")
      .withIndex("by_fixtureId", (q) => q.eq("fixtureId", args.fixtureId))
      .first();
    if (!row) throw new Error("live_not_started");
    // applyScore validates the point value + team (throws on bad input).
    const next = applyScore(
      { homeScore: row.homeScore, awayScore: row.awayScore },
      args.team,
      args.points,
    );
    await ctx.db.patch(row._id, { ...next, updatedAt: new Date().toISOString() });
    return toLiveDto({ ...row, ...next, updatedAt: new Date().toISOString() });
  },
});

export const setLiveScore = internalMutation({
  args: {
    fixtureId: v.id("fixtures"),
    homeScore: v.number(),
    awayScore: v.number(),
  },
  returns: liveStateDtoValidator,
  handler: async (ctx, args) => {
    if (!isNonNegInt(args.homeScore) || !isNonNegInt(args.awayScore)) {
      throw new Error("invalid_score");
    }
    const row = await ctx.db
      .query("liveGameState")
      .withIndex("by_fixtureId", (q) => q.eq("fixtureId", args.fixtureId))
      .first();
    if (!row) throw new Error("live_not_started");
    const patch = {
      homeScore: args.homeScore,
      awayScore: args.awayScore,
      updatedAt: new Date().toISOString(),
    };
    await ctx.db.patch(row._id, patch);
    return toLiveDto({ ...row, ...patch });
  },
});

export const updateLiveState = internalMutation({
  args: {
    fixtureId: v.id("fixtures"),
    period: v.optional(v.number()),
    clock: v.optional(v.union(v.string(), v.null())),
    status: v.optional(v.string()),
  },
  returns: liveStateDtoValidator,
  handler: async (ctx, args) => {
    if (args.period !== undefined && (!Number.isInteger(args.period) || args.period < 1)) {
      throw new Error("invalid_period");
    }
    if (args.status !== undefined && !isLiveStatus(args.status)) {
      throw new Error("invalid_status");
    }
    const row = await ctx.db
      .query("liveGameState")
      .withIndex("by_fixtureId", (q) => q.eq("fixtureId", args.fixtureId))
      .first();
    if (!row) throw new Error("live_not_started");
    const patch: {
      period?: number;
      clock?: string | null;
      status?: string;
      updatedAt: string;
    } = { updatedAt: new Date().toISOString() };
    if (args.period !== undefined) patch.period = args.period;
    if (args.clock !== undefined) patch.clock = args.clock;
    if (args.status !== undefined) patch.status = args.status;
    await ctx.db.patch(row._id, patch);
    return toLiveDto({ ...row, ...patch });
  },
});

export const endLiveGame = internalMutation({
  args: { fixtureId: v.id("fixtures"), actorUserId: v.string() },
  returns: liveStateDtoValidator,
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("liveGameState")
      .withIndex("by_fixtureId", (q) => q.eq("fixtureId", args.fixtureId))
      .first();
    if (!row) throw new Error("live_not_started");
    const fixture = await ctx.db.get(args.fixtureId);
    if (!fixture) throw new Error("fixture_not_found");

    const now = new Date().toISOString();
    // 1) live state → final
    await ctx.db.patch(row._id, { status: "final", updatedAt: now });

    // 2) write the final score into gameResults (same shape recordGameResult
    //    uses) so standings pick it up, and flip the fixture to "final".
    const resultPayload = {
      fixtureId: args.fixtureId,
      homeScore: row.homeScore,
      awayScore: row.awayScore,
      playerStatsJson: null,
      recordedAt: now,
      recordedBy: args.actorUserId,
    };
    const existingResult = await ctx.db
      .query("gameResults")
      .withIndex("by_fixtureId", (q) => q.eq("fixtureId", args.fixtureId))
      .first();
    if (existingResult) {
      await ctx.db.replace(existingResult._id, resultPayload);
    } else {
      await ctx.db.insert("gameResults", resultPayload);
    }
    if (fixture.status !== "final") {
      await ctx.db.patch(args.fixtureId, { status: "final" });
    }

    return toLiveDto({ ...row, status: "final", updatedAt: now });
  },
});

export const getLiveGameState = query({
  args: { fixtureId: v.id("fixtures") },
  returns: v.union(
    v.object({
      homeScore: v.number(),
      awayScore: v.number(),
      period: v.number(),
      clock: v.union(v.string(), v.null()),
      status: v.string(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("liveGameState")
      .withIndex("by_fixtureId", (q) => q.eq("fixtureId", args.fixtureId))
      .first();
    if (!row) return null;
    // PUBLIC projection — operator/identity fields are not exposed.
    return {
      homeScore: row.homeScore,
      awayScore: row.awayScore,
      period: row.period,
      clock: row.clock,
      status: row.status,
    };
  },
});

// Single-call public live-state read for the client poll (cost: WSM-000192).
// The poll route used to run FOUR separate public queries every few seconds
// (league visibility + fixture + season + live state) — the dominant prod
// function-call driver. This folds the same public + cross-league leak guard
// and the live-state read into ONE function call.
//   - returns `null`            → guard failed → the route answers 404
//   - returns `{ live: ... }`   → guard passed (live may be null = not started)
export const getPublicLiveGameState = queryGeneric({
  args: { leagueId: v.id("leagues"), fixtureId: v.id("fixtures") },
  returns: v.union(
    v.null(),
    v.object({
      live: v.union(
        v.object({
          homeScore: v.number(),
          awayScore: v.number(),
          period: v.number(),
          clock: v.union(v.string(), v.null()),
          status: v.string(),
        }),
        v.null(),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    const league = await ctx.db.get(args.leagueId);
    if (!league || !league.isPublic) return null;
    const fixture = await ctx.db.get(args.fixtureId);
    if (!fixture) return null;
    // Cross-league leak guard: the fixture's season must belong to THIS league.
    const season = await ctx.db.get(fixture.seasonId);
    if (!season || season.leagueId !== args.leagueId) return null;
    const row = await ctx.db
      .query("liveGameState")
      .withIndex("by_fixtureId", (q) => q.eq("fixtureId", args.fixtureId))
      .first();
    return {
      live: row
        ? {
            homeScore: row.homeScore,
            awayScore: row.awayScore,
            period: row.period,
            clock: row.clock,
            status: row.status,
          }
        : null,
    };
  },
});

/* ───────────────────────── Playoffs (WSM-000164) ───────────────────────── */

/** Ordered team ids by league standings (regular season only), seeds 1..N. */
async function seasonStandingTeamIds(
  ctx: MutationCtx,
  season: { _id: Id<"seasons">; leagueId: Id<"leagues"> },
): Promise<string[]> {
  const teamRows = await ctx.db
    .query("teams")
    .withIndex("by_leagueId", (q) => q.eq("leagueId", season.leagueId))
    .collect();
  const fixtureRows = (
    await ctx.db
      .query("fixtures")
      .withIndex("by_seasonId", (q) => q.eq("seasonId", season._id))
      .collect()
  ).filter((f) => f.stage !== "playoff");
  const finalIds = fixtureRows
    .filter((f) => f.status === "final")
    .map((f) => f._id);
  const results = (
    await Promise.all(
      finalIds.map((fid) =>
        ctx.db
          .query("gameResults")
          .withIndex("by_fixtureId", (q) => q.eq("fixtureId", fid))
          .first(),
      ),
    )
  ).filter((r): r is NonNullable<typeof r> => r !== null);
  return computeStandingsPure({
    teams: teamRows.map((t) => ({
      _id: t._id,
      name: t.name,
      divisionId: t.divisionId,
    })),
    fixtures: fixtureRows.map((f) => ({
      _id: f._id,
      seasonId: f.seasonId,
      homeTeamId: f.homeTeamId,
      awayTeamId: f.awayTeamId,
      status: f.status,
    })),
    results: results.map((r) => ({
      fixtureId: r.fixtureId,
      homeScore: r.homeScore,
      awayScore: r.awayScore,
    })),
  }).map((r) => r.teamId);
}

/**
 * Playoff seed order (WSM-000184). Default = league standings order. When
 * `divisionWinnersQualify` is on, each division's best team (its first
 * appearance in standings order) is seeded ahead of all non-winners, with both
 * groups keeping their standings order — so division champs always make the
 * field and get the top seeds. Teams without a division are never "winners".
 */
async function seasonPlayoffSeeds(
  ctx: MutationCtx,
  season: { _id: Id<"seasons">; leagueId: Id<"leagues"> },
  divisionWinnersQualify: boolean,
): Promise<string[]> {
  const ordered = await seasonStandingTeamIds(ctx, season);
  if (!divisionWinnersQualify) return ordered;

  const teamRows = await ctx.db
    .query("teams")
    .withIndex("by_leagueId", (q) => q.eq("leagueId", season.leagueId))
    .collect();
  const divisionByTeam = new Map<string, string | null>(
    teamRows.map((t) => [t._id as string, (t.divisionId as string | null) ?? null]),
  );

  const winners: string[] = [];
  const seenDivisions = new Set<string>();
  for (const teamId of ordered) {
    const division = divisionByTeam.get(teamId) ?? null;
    if (division && !seenDivisions.has(division)) {
      seenDivisions.add(division);
      winners.push(teamId);
    }
  }
  const winnerSet = new Set(winners);
  const rest = ordered.filter((t) => !winnerSet.has(t));
  return [...winners, ...rest];
}

/** Insert a playoff fixture for a matchup whose two teams are known. */
async function spawnPlayoffFixture(
  ctx: MutationCtx,
  m: {
    seasonId: Id<"seasons">;
    homeTeamId: Id<"teams"> | null;
    awayTeamId: Id<"teams"> | null;
  },
  createdBy: string,
): Promise<Id<"fixtures">> {
  if (!m.homeTeamId || !m.awayTeamId) throw new Error("matchup_teams_unknown");
  return ctx.db.insert("fixtures", {
    seasonId: m.seasonId,
    homeTeamId: m.homeTeamId,
    awayTeamId: m.awayTeamId,
    scheduledAt: null,
    week: null,
    venue: null,
    status: "scheduled",
    stage: "playoff",
    createdAt: new Date().toISOString(),
    createdBy,
  });
}

/**
 * Idempotent bracket recompute. In (bracket, round, slot) order: spawn a
 * fixture when both teams are known and the matchup is not a bye, resolve a
 * decisive game's winner, propagate that winner into its parent slot, and — for
 * double-elimination — drop the LOSER into its losers-bracket slot. First-round
 * byes carry a pre-set winner (no fixture) and only need propagation. A tie
 * leaves the matchup unresolved (playoff games are recorded decisive).
 *
 * The pass repeats until it reaches a fixed point so a chain of byes feeding
 * one another (and bye-vs-bye round-2 matchups) all resolve in one call.
 */
async function advanceBracketForSeason(
  ctx: MutationCtx,
  seasonId: Id<"seasons">,
): Promise<void> {
  const bracket = await ctx.db
    .query("playoffBrackets")
    .withIndex("by_seasonId", (q) => q.eq("seasonId", seasonId))
    .first();
  if (!bracket) return;

  const matchups = await ctx.db
    .query("playoffMatchups")
    .withIndex("by_bracketId", (q) => q.eq("bracketId", bracket._id))
    .collect();
  const byId = new Map(matchups.map((m) => [m._id, m]));
  const bracketRank = (t: string | undefined) =>
    t === "losers" ? 1 : t === "grandFinal" ? 2 : 0; // winners first
  const ordered = [...matchups].sort(
    (a, b) =>
      bracketRank(a.bracketType) - bracketRank(b.bracketType) ||
      a.round - b.round ||
      a.slot - b.slot,
  );

  const setSide = async (
    parentId: Id<"playoffMatchups">,
    side: string,
    teamId: Id<"teams">,
  ) => {
    const parent = byId.get(parentId);
    if (!parent) return;
    if (side === "home" && parent.homeTeamId !== teamId) {
      await ctx.db.patch(parent._id, { homeTeamId: teamId });
      parent.homeTeamId = teamId;
    } else if (side === "away" && parent.awayTeamId !== teamId) {
      await ctx.db.patch(parent._id, { awayTeamId: teamId });
      parent.awayTeamId = teamId;
    }
  };

  // Iterate to a fixed point: bye winners can cascade into later matchups.
  let changed = true;
  let guard = 0;
  while (changed && guard++ < matchups.length + 2) {
    changed = false;
    for (const m of ordered) {
      // 1. Spawn this matchup's fixture once both teams are known (not a bye).
      const isBye = !m.awayTeamId && m.homeSeed != null && m.awaySeed == null;
      if (m.homeTeamId && m.awayTeamId && !m.fixtureId) {
        const fid = await spawnPlayoffFixture(ctx, m, "system");
        await ctx.db.patch(m._id, { fixtureId: fid });
        m.fixtureId = fid;
        changed = true;
      }
      // 2. Resolve a decisive winner from the played fixture.
      if (m.fixtureId && !m.winnerTeamId) {
        const fx = await ctx.db.get(m.fixtureId);
        if (fx && fx.status === "final") {
          const res = await ctx.db
            .query("gameResults")
            .withIndex("by_fixtureId", (q) => q.eq("fixtureId", m.fixtureId!))
            .first();
          if (res && res.homeScore !== res.awayScore) {
            const winner =
              res.homeScore > res.awayScore ? fx.homeTeamId : fx.awayTeamId;
            await ctx.db.patch(m._id, { winnerTeamId: winner });
            m.winnerTeamId = winner;
            changed = true;
          }
        }
      }
      // The loser is the non-winning known side (null for byes / TBD games).
      const loserTeamId: Id<"teams"> | null =
        m.winnerTeamId && m.homeTeamId && m.awayTeamId
          ? m.winnerTeamId === m.homeTeamId
            ? m.awayTeamId
            : m.homeTeamId
          : null;
      // 3. Propagate the winner into the parent slot.
      if (m.winnerTeamId && m.nextMatchupId && m.nextSlot) {
        const before = byId.get(m.nextMatchupId as Id<"playoffMatchups">);
        const had =
          m.nextSlot === "home"
            ? before?.homeTeamId === m.winnerTeamId
            : before?.awayTeamId === m.winnerTeamId;
        await setSide(
          m.nextMatchupId as Id<"playoffMatchups">,
          m.nextSlot,
          m.winnerTeamId,
        );
        if (!had) changed = true;
      }
      // 4. Double-elim: drop the loser of a decided game into the LB slot.
      if (loserTeamId && !isBye && m.loserNextMatchupId && m.loserNextSlot) {
        const target = byId.get(
          m.loserNextMatchupId as Id<"playoffMatchups">,
        );
        const had =
          m.loserNextSlot === "home"
            ? target?.homeTeamId === loserTeamId
            : target?.awayTeamId === loserTeamId;
        await setSide(
          m.loserNextMatchupId as Id<"playoffMatchups">,
          m.loserNextSlot,
          loserTeamId,
        );
        if (!had) changed = true;
      }
    }
  }
}

/**
 * Generate a playoff bracket from the season's standings (WSM-flex-brackets).
 *
 * `size` is the qualifying team count — any value ≥ 2 (e.g. 5, 6, 10, 12). The
 * bracket size is rounded up to the next power of two and the top
 * `(bracketSize - teamCount)` seeds get first-round byes (auto-advanced, no
 * game). `format` selects single- or double-elimination (defaults to the
 * season's `playoffFormat`). Re-running re-snapshots seeds, but refuses to wipe
 * a bracket that has a played/in-progress game unless `confirm` is set.
 */
export const generatePlayoffBracket = internalMutationGeneric({
  args: {
    seasonId: v.id("seasons"),
    size: v.number(),
    actorUserId: v.string(),
    confirm: v.optional(v.boolean()),
    divisionWinnersQualify: v.optional(v.boolean()),
    format: v.optional(v.string()), // "single" | "double"
  },
  returns: v.object({
    bracketId: v.string(),
    size: v.number(),
    rounds: v.number(),
    matchups: v.number(),
  }),
  handler: async (ctx, args) => {
    const teamCount = args.size;
    if (!Number.isInteger(teamCount) || teamCount < 2 || teamCount > 64) {
      throw new Error("invalid_bracket_size");
    }
    const season = await ctx.db.get(args.seasonId);
    if (!season) throw new Error("season_not_found");
    if (season.status === "completed") throw new Error("season_completed");
    const format =
      (args.format ?? season.playoffFormat) === "double" ? "double" : "single";
    // Honor the season's configured qualification rule (overridable per call).
    const divisionWinnersQualify =
      args.divisionWinnersQualify ?? season.divisionWinnersQualify ?? false;

    // Existing bracket: results-guard, then clean wipe.
    const existing = await ctx.db
      .query("playoffBrackets")
      .withIndex("by_seasonId", (q) => q.eq("seasonId", args.seasonId))
      .first();
    if (existing) {
      const existingMatchups = await ctx.db
        .query("playoffMatchups")
        .withIndex("by_bracketId", (q) => q.eq("bracketId", existing._id))
        .collect();
      if (!args.confirm) {
        for (const m of existingMatchups) {
          if (!m.fixtureId) continue;
          const res = await ctx.db
            .query("gameResults")
            .withIndex("by_fixtureId", (q) => q.eq("fixtureId", m.fixtureId!))
            .first();
          if (res) throw new Error("bracket_has_results");
          const live = await ctx.db
            .query("liveGameState")
            .withIndex("by_fixtureId", (q) => q.eq("fixtureId", m.fixtureId!))
            .first();
          if (live) throw new Error("bracket_has_results");
        }
      }
      for (const m of existingMatchups) {
        if (m.fixtureId) {
          for (const gr of await ctx.db
            .query("gameResults")
            .withIndex("by_fixtureId", (q) => q.eq("fixtureId", m.fixtureId!))
            .collect())
            await ctx.db.delete(gr._id);
          for (const lg of await ctx.db
            .query("liveGameState")
            .withIndex("by_fixtureId", (q) => q.eq("fixtureId", m.fixtureId!))
            .collect())
            await ctx.db.delete(lg._id);
          await ctx.db.delete(m.fixtureId);
        }
        await ctx.db.delete(m._id);
      }
      await ctx.db.delete(existing._id);
    }

    const seeds = await seasonPlayoffSeeds(
      ctx as MutationCtx,
      season,
      divisionWinnersQualify,
    );
    if (seeds.length < teamCount) throw new Error("not_enough_teams");

    const plan =
      format === "double"
        ? buildDoubleElimBracket(teamCount)
        : buildBracket(teamCount);
    const bracketSize = nextPowerOfTwo(teamCount);
    const createdAt = new Date().toISOString();
    const bracketId = await ctx.db.insert("playoffBrackets", {
      seasonId: args.seasonId,
      leagueId: season.leagueId,
      size: bracketSize,
      rounds: plan.rounds,
      createdAt,
      createdBy: args.actorUserId,
      format,
      teamCount,
    });

    // Keying must distinguish sub-brackets in double-elim (winners/losers each
    // have their own round/slot space; grand final is its own bucket).
    const keyOf = (
      bracketType: string | undefined,
      round: number,
      slot: number,
    ) => `${bracketType ?? "winners"}:${round}:${slot}`;

    // Insert matchups, then wire parent + loser pointers, then spawn fixtures.
    const idByKey = new Map<string, Id<"playoffMatchups">>();
    for (const mp of plan.matchups) {
      const homeTeamId =
        mp.homeSeed != null ? (seeds[mp.homeSeed - 1] as Id<"teams">) : null;
      const awayTeamId =
        mp.awaySeed != null ? (seeds[mp.awaySeed - 1] as Id<"teams">) : null;
      // A bye: the present (home) team auto-advances at generation time.
      const isBye = mp.isBye === true && homeTeamId != null;
      const id = await ctx.db.insert("playoffMatchups", {
        bracketId,
        seasonId: args.seasonId,
        round: mp.round,
        slot: mp.slot,
        homeSeed: mp.homeSeed,
        awaySeed: mp.awaySeed,
        homeTeamId,
        awayTeamId,
        nextMatchupId: null,
        nextSlot: null,
        winnerTeamId: isBye ? homeTeamId : null,
        fixtureId: null,
        ...(mp.bracketType ? { bracketType: mp.bracketType } : {}),
        loserNextMatchupId: null,
        loserNextSlot: null,
      });
      idByKey.set(keyOf(mp.bracketType, mp.round, mp.slot), id);
    }

    // Winner-advancement pointers (parent slot/side within the same bracket).
    for (const mp of plan.matchups) {
      if (mp.parentSlot == null || mp.parentSide == null) continue;
      await ctx.db.patch(
        idByKey.get(keyOf(mp.bracketType, mp.round, mp.slot))!,
        {
          nextMatchupId: idByKey.get(
            keyOf(mp.bracketType, mp.round + 1, mp.parentSlot),
          )!,
          nextSlot: mp.parentSide,
        },
      );
    }

    // Double-elim: winners-bracket losers route into the losers bracket; the
    // last LB matchup and the WB final's winner both feed the grand final.
    if (format === "double") {
      for (const mp of plan.matchups) {
        if (
          mp.loserParentRound == null ||
          mp.loserParentSlot == null ||
          mp.loserParentSide == null
        ) {
          continue;
        }
        await ctx.db.patch(
          idByKey.get(keyOf(mp.bracketType, mp.round, mp.slot))!,
          {
            loserNextMatchupId: idByKey.get(
              keyOf("losers", mp.loserParentRound, mp.loserParentSlot),
            )!,
            loserNextSlot: mp.loserParentSide,
          },
        );
      }
      // WB champion → grand final home; LB champion → grand final away.
      const gfId = idByKey.get(keyOf("grandFinal", 1, 0))!;
      const wbFinalKey = keyOf("winners", plan.rounds, 0);
      await ctx.db.patch(idByKey.get(wbFinalKey)!, {
        nextMatchupId: gfId,
        nextSlot: "home",
      });
      const lbRounds = plan.rounds > 1 ? 2 * (plan.rounds - 1) : 0;
      const lbFinalKey = keyOf("losers", lbRounds, 0);
      const lbFinalId = idByKey.get(lbFinalKey);
      if (lbFinalId) {
        await ctx.db.patch(lbFinalId, {
          nextMatchupId: gfId,
          nextSlot: "away",
        });
      }
    }

    // Resolve any first-round byes immediately (auto-advance, no fixture), then
    // spawn fixtures for every matchup whose two teams are now known.
    await advanceBracketForSeason(ctx as MutationCtx, args.seasonId);

    return {
      bracketId,
      size: bracketSize,
      rounds: plan.rounds,
      matchups: plan.matchups.length,
    };
  },
});

/** Manual/repair recompute of a season's bracket (advancement is otherwise
 * automatic on result recording). */
export const advancePlayoffBracket = internalMutationGeneric({
  args: { seasonId: v.id("seasons") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await advanceBracketForSeason(ctx as MutationCtx, args.seasonId);
    return null;
  },
});

const playoffMatchupDtoValidator = v.object({
  id: v.string(),
  round: v.number(),
  slot: v.number(),
  homeSeed: v.union(v.number(), v.null()),
  awaySeed: v.union(v.number(), v.null()),
  homeTeamId: v.union(v.string(), v.null()),
  awayTeamId: v.union(v.string(), v.null()),
  homeTeamName: v.union(v.string(), v.null()),
  awayTeamName: v.union(v.string(), v.null()),
  winnerTeamId: v.union(v.string(), v.null()),
  fixtureId: v.union(v.string(), v.null()),
  status: v.union(v.string(), v.null()),
  homeScore: v.union(v.number(), v.null()),
  awayScore: v.union(v.number(), v.null()),
  // "winners" | "losers" | "grandFinal" — null for single-elim brackets.
  bracketType: v.union(v.string(), v.null()),
  // First-round bye marker (team auto-advanced, no game).
  isBye: v.boolean(),
  hasPlayLog: v.boolean(),
});

const playoffChampionDtoValidator = v.object({
  teamId: v.string(),
  teamName: v.union(v.string(), v.null()),
});

function championFromMatchups(
  matchups: Array<{
    round: number;
    bracketType?: string | null;
    winnerTeamId?: string | null;
    homeTeamId?: string | null;
    awayTeamId?: string | null;
    homeTeamName?: string | null;
    awayTeamName?: string | null;
  }>,
  format: string,
): { teamId: string; teamName: string | null } | null {
  if (format === "double") {
    const grandFinal = matchups.find((m) => m.bracketType === "grandFinal");
    if (!grandFinal?.winnerTeamId) return null;
    return {
      teamId: grandFinal.winnerTeamId,
      teamName:
        grandFinal.winnerTeamId === grandFinal.homeTeamId
          ? (grandFinal.homeTeamName ?? null)
          : (grandFinal.awayTeamName ?? null),
    };
  }
  const final = matchups.reduce<(typeof matchups)[number] | null>(
    (best, m) =>
      (m.bracketType ?? "winners") === "winners" && m.round > (best?.round ?? -1)
        ? m
        : best,
    null,
  );
  if (!final?.winnerTeamId) return null;
  return {
    teamId: final.winnerTeamId,
    teamName:
      final.winnerTeamId === final.homeTeamId
        ? (final.homeTeamName ?? null)
        : (final.awayTeamName ?? null),
  };
}

/** Bracket tree DTO for the UI (WSM-000165). Null when no bracket exists. */
export const getPlayoffBracket = queryGeneric({
  args: { seasonId: v.id("seasons") },
  returns: v.union(
    v.object({
      bracketId: v.string(),
      size: v.number(),
      rounds: v.number(),
      format: v.string(), // "single" | "double"
      matchups: v.array(playoffMatchupDtoValidator),
      champion: v.union(playoffChampionDtoValidator, v.null()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const bracket = await ctx.db
      .query("playoffBrackets")
      .withIndex("by_seasonId", (q) => q.eq("seasonId", args.seasonId))
      .first();
    if (!bracket) return null;

    const matchups = await ctx.db
      .query("playoffMatchups")
      .withIndex("by_bracketId", (q) => q.eq("bracketId", bracket._id))
      .collect();

    const dtos = await Promise.all(
      matchups
        .sort((a, b) => a.round - b.round || a.slot - b.slot)
        .map(async (m) => {
          const home = m.homeTeamId ? await ctx.db.get(m.homeTeamId) : null;
          const away = m.awayTeamId ? await ctx.db.get(m.awayTeamId) : null;
          let status: string | null = null;
          let homeScore: number | null = null;
          let awayScore: number | null = null;
          let hasPlayLog = false;
          if (m.fixtureId) {
            const fx = await ctx.db.get(m.fixtureId);
            status = fx?.status ?? null;
            if (fx?.status === "final") {
              const res = await ctx.db
                .query("gameResults")
                .withIndex("by_fixtureId", (q) =>
                  q.eq("fixtureId", m.fixtureId!),
                )
                .first();
              homeScore = res?.homeScore ?? null;
              awayScore = res?.awayScore ?? null;
              const log = await ctx.db
                .query("gamePlayLogs")
                .withIndex("by_fixtureId", (q) =>
                  q.eq("fixtureId", m.fixtureId!),
                )
                .first();
              hasPlayLog = log != null;
            }
          }
          // A first-round bye: a single present team with no opponent/game.
          const isBye =
            m.homeSeed != null && m.awaySeed == null && !m.awayTeamId;
          return {
            id: m._id,
            round: m.round,
            slot: m.slot,
            homeSeed: m.homeSeed,
            awaySeed: m.awaySeed,
            homeTeamId: m.homeTeamId,
            awayTeamId: m.awayTeamId,
            homeTeamName: home?.name ?? null,
            awayTeamName: away?.name ?? null,
            winnerTeamId: m.winnerTeamId,
            fixtureId: m.fixtureId,
            status,
            homeScore,
            awayScore,
            bracketType: m.bracketType ?? null,
            isBye,
            hasPlayLog,
          };
        }),
    );

    const format = bracket.format ?? "single";
    return {
      bracketId: bracket._id,
      size: bracket.size,
      rounds: bracket.rounds,
      format,
      matchups: dtos,
      champion: championFromMatchups(dtos, format),
    };
  },
});

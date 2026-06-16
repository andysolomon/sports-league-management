import {
  internalMutationGeneric,
  internalQueryGeneric,
  queryGeneric,
} from "convex/server";
import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { writeAuditLog } from "./lib/auditLog";
import { computeStandingsPure } from "./lib/standings";

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
  };
}

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
}) {
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
}) {
  return {
    id: doc._id,
    name: doc.name,
    leagueId: doc.leagueId,
    startDate: doc.startDate ?? null,
    endDate: doc.endDate ?? null,
    status: doc.status,
    rosterLocked: doc.rosterLocked ?? false,
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

export const getLeagueForOrg = queryGeneric({
  args: { orgId: v.string() },
  returns: v.union(
    v.object({
      id: v.string(),
      token: v.union(v.string(), v.null()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const doc = await ctx.db
      .query("leagues")
      .withIndex("by_orgId", (q) => q.eq("orgId", args.orgId))
      .unique();

    if (!doc) return null;
    return { id: doc._id, token: doc.inviteToken ?? null };
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
    v.object({
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
    }),
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
    v.object({
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
    }),
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
    v.object({
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
    }),
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
  },
  returns: v.object({
    dto: v.object({
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
    }),
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
    };
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
  },
  returns: v.union(
    v.object({
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
    }),
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
      await ctx.db.patch(existing._id, {
        startDate: args.startDate,
        endDate: args.endDate,
        status: args.status,
      });
      return {
        dto: toSeasonDto({
          ...existing,
          startDate: args.startDate,
          endDate: args.endDate,
          status: args.status,
        }),
        created: false,
      };
    }

    const seasonId = await ctx.db.insert("seasons", {
      ...args,
      rosterLocked: false,
    });
    return {
      dto: {
        id: seasonId,
        name: args.name,
        leagueId: args.leagueId,
        startDate: args.startDate,
        endDate: args.endDate,
        status: args.status,
        rosterLocked: false,
      },
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
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.seasonId);
    if (!existing) return null;
    await ctx.db.patch(args.seasonId, {
      name: args.name,
      startDate: args.startDate,
      endDate: args.endDate,
    });
    return toSeasonDto({
      ...existing,
      name: args.name,
      startDate: args.startDate,
      endDate: args.endDate,
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
 * Delete a season and cascade its season-scoped rows (WSM-000126): fixtures and
 * their game results, player attributes, and roster assignments. (rosterAuditLog
 * has no by-season index and is cleaned on league delete — left as harmless
 * history here. Mirrors the per-season cascade in deleteLeague.)
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
      await ctx.db.delete(f._id);
    }

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

export const assignPlayerToRoster = internalMutation({
  args: {
    seasonId: v.id("seasons"),
    teamId: v.id("teams"),
    playerId: v.id("players"),
    positionSlot: v.string(),
    actorUserId: v.string(),
  },
  returns: rosterAssignmentDtoValidator,
  handler: async (ctx, args) => {
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
    if (team.rosterLimit !== null && activeCount >= team.rosterLimit) {
      throw new Error("roster_limit_exceeded");
    }

    const slotActive = teamAssignments.filter(
      (row) =>
        row.status === "active" && row.positionSlot === args.positionSlot,
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
  },
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
 * the active season, else whichever exists first. Matches the convention the
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
  const chosen =
    seasons.find((s) => s.status === "active") ?? seasons[0] ?? null;
  return chosen ? chosen._id : null;
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
          createdAt: row.createdAt,
          createdBy: row.createdBy,
        };
      }),
    );
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
      .filter((f) => f.status === "final")
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
      fixtures: fixtureRows.map((f) => ({
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
      .filter((f) => f.status === "final")
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
      fixtures: fixtureRows.map((f) => ({
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
      .filter((f) => f.status === "final")
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
      fixtures: fixtureRows.map((f) => ({
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
const publicStreamDtoValidator = v.union(
  v.object({
    status: v.string(),
    muxPlaybackId: v.string(),
    vodAssetId: v.union(v.string(), v.null()),
  }),
  v.null(),
);

export const createGameStream = internalMutationGeneric({
  args: {
    fixtureId: v.id("fixtures"),
    muxLiveStreamId: v.string(),
    muxPlaybackId: v.string(),
    startedBy: v.string(),
    maxDurationMinutes: v.number(),
  },
  returns: v.object({
    id: v.string(),
    fixtureId: v.string(),
    status: v.string(),
    muxPlaybackId: v.string(),
  }),
  handler: async (ctx, args) => {
    const fixture = await ctx.db.get(args.fixtureId);
    if (!fixture) throw new Error("fixture_not_found");

    const payload = {
      fixtureId: args.fixtureId,
      muxLiveStreamId: args.muxLiveStreamId,
      muxPlaybackId: args.muxPlaybackId,
      status: "idle",
      vodAssetId: null,
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
      muxPlaybackId: args.muxPlaybackId,
    };
  },
});

export const updateGameStreamStatus = internalMutationGeneric({
  args: {
    muxLiveStreamId: v.string(),
    // Optional so a `video.asset.ready` webhook can attach the VOD id without
    // changing status (the stream has already ended by then).
    status: v.optional(v.string()),
    vodAssetId: v.optional(v.union(v.string(), v.null())),
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
      endedAt?: string | null;
    } = {};
    if (args.status !== undefined) patch.status = args.status;
    if (args.vodAssetId !== undefined) patch.vodAssetId = args.vodAssetId;
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
      muxPlaybackId: row.muxPlaybackId,
      vodAssetId: row.vodAssetId,
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
    v.object({ muxLiveStreamId: v.string(), status: v.string() }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("gameStreams")
      .withIndex("by_fixtureId", (q) => q.eq("fixtureId", args.fixtureId))
      .first();
    if (!row) return null;
    return { muxLiveStreamId: row.muxLiveStreamId, status: row.status };
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

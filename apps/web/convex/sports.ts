import { mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { writeAuditLog } from "./lib/auditLog";

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

function toDivisionDto(doc: {
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
  }),
  handler: async (ctx, args) => {
    const subscriptionDocs = await ctx.db
      .query("leagueSubscriptions")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();

    const subscribedLeagueIds = subscriptionDocs.map((doc) => doc.leagueId);
    const orgLeagueDocs = await Promise.all(
      args.orgIds.map((orgId) =>
        ctx.db
          .query("leagues")
          .withIndex("by_orgId", (q) => q.eq("orgId", orgId))
          .collect(),
      ),
    );

    const visibleLeagueIds = Array.from(
      new Set([
        ...subscribedLeagueIds,
        ...orgLeagueDocs.flat().map((league) => league._id),
      ]),
    );

    return {
      visibleLeagueIds,
      subscribedLeagueIds,
    };
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
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.divisionId);
    return doc ? toDivisionDto(doc) : null;
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

export const upsertLeague = mutationGeneric({
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

export const upsertDivision = mutationGeneric({
  args: {
    name: v.string(),
    leagueId: v.id("leagues"),
  },
  returns: v.object({
    dto: v.object({
      id: v.string(),
      name: v.string(),
      leagueId: v.string(),
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

    const divisionId = await ctx.db.insert("divisions", args);
    return {
      dto: { id: divisionId, name: args.name, leagueId: args.leagueId },
      created: true,
    };
  },
});

export const upsertTeam = mutationGeneric({
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
      },
      created: true,
    };
  },
});

export const upsertPlayer = mutationGeneric({
  args: {
    name: v.string(),
    leagueId: v.id("leagues"),
    teamId: v.id("teams"),
    position: v.string(),
    jerseyNumber: v.union(v.number(), v.null()),
    dateOfBirth: v.union(v.string(), v.null()),
    status: v.string(),
    headshotUrl: v.union(v.string(), v.null()),
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
      },
      created: true,
    };
  },
});

export const createTeam = mutationGeneric({
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
    };
  },
});

export const updateTeam = mutationGeneric({
  args: {
    teamId: v.id("teams"),
    name: v.optional(v.string()),
    city: v.optional(v.string()),
    stadium: v.optional(v.string()),
    foundedYear: v.optional(v.union(v.number(), v.null())),
    location: v.optional(v.string()),
    divisionId: v.optional(v.id("divisions")),
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
    };
    await ctx.db.patch(args.teamId, patch);

    return toTeamDto({
      ...existing,
      ...patch,
    });
  },
});

export const createPlayer = mutationGeneric({
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
  }),
  handler: async (ctx, args) => {
    const team = await ctx.db.get(args.teamId);
    if (!team) {
      throw new Error("Team not found");
    }

    const playerId = await ctx.db.insert("players", {
      ...args,
      leagueId: team.leagueId,
      headshotUrl: null,
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
    };
  },
});

export const updatePlayer = mutationGeneric({
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
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.playerId);
    if (!existing) return null;

    let leagueId = existing.leagueId;
    if (args.teamId !== undefined) {
      const team = await ctx.db.get(args.teamId);
      if (!team) {
        throw new Error("Team not found");
      }
      leagueId = team.leagueId;
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

export const deletePlayer = mutationGeneric({
  args: { playerId: v.id("players") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.delete(args.playerId);
    return null;
  },
});

export const upsertSeason = mutationGeneric({
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

export const setLeagueInviteToken = mutationGeneric({
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

export const subscribeToLeague = mutationGeneric({
  args: {
    userId: v.string(),
    leagueId: v.id("leagues"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const league = await ctx.db.get(args.leagueId);
    if (!league || !league.isPublic) {
      throw new Error("League not found or not public");
    }

    const existing =
      (
        await ctx.db
          .query("leagueSubscriptions")
          .withIndex("by_userId", (q) => q.eq("userId", args.userId))
          .collect()
      ).find((subscription) => subscription.leagueId === args.leagueId) ?? null;

    if (!existing) {
      await ctx.db.insert("leagueSubscriptions", args);
    }
    return null;
  },
});

export const unsubscribeFromLeague = mutationGeneric({
  args: {
    userId: v.string(),
    leagueId: v.id("leagues"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing =
      (
        await ctx.db
          .query("leagueSubscriptions")
          .withIndex("by_userId", (q) => q.eq("userId", args.userId))
          .collect()
      ).find((subscription) => subscription.leagueId === args.leagueId) ?? null;

    if (existing) {
      await ctx.db.delete(existing._id);
    }
    return null;
  },
});

export const setSyncEnabled = mutationGeneric({
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

export const writeSyncReport = mutationGeneric({
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

export const reorderDepthChart = mutation({
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

export const setRosterLocked = mutation({
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

export const assignPlayerToRoster = mutation({
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

export const removePlayerFromRoster = mutation({
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

export const updateRosterStatus = mutation({
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
export const ingestPlayerAttributes = mutationGeneric({
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
    const rows = await ctx.db
      .query("playerAttributes")
      .withIndex("by_playerId_seasonId", (q) =>
        q.eq("playerId", args.playerId),
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

export const setLeaguePublic = mutationGeneric({
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

export const createFixture = mutationGeneric({
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

export const updateFixture = mutationGeneric({
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

export const deleteFixture = mutationGeneric({
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

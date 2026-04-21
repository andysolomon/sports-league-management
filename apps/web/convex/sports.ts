import { mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

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
  };
}

function toPlayerDto(doc: {
  _id: string;
  name: string;
  teamId: string;
  position: string;
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
}) {
  return {
    id: doc._id,
    name: doc.name,
    leagueId: doc.leagueId,
    startDate: doc.startDate ?? null,
    endDate: doc.endDate ?? null,
    status: doc.status,
  };
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

    const playerId = await ctx.db.insert("players", args);
    return {
      dto: {
        id: playerId,
        name: args.name,
        teamId: args.teamId,
        position: args.position,
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
    });

    return {
      id: playerId,
      name: args.name,
      teamId: args.teamId,
      position: args.position,
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

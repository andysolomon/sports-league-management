import { v } from "convex/values";
import { mutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

const FIXTURE_LEAGUE_PREFIX = "E2E:";
const SEED_ACTOR = "e2e_seed_harness";

function assertSeedEnabled(): void {
  if (process.env.CONVEX_ENABLE_E2E_SEED !== "1") {
    throw new Error("e2e_seed_disabled");
  }
}

function fixtureLeagueName(fixtureKey: string): string {
  return `${FIXTURE_LEAGUE_PREFIX}${fixtureKey}`;
}

const fixtureResultValidator = v.object({
  fixtureKey: v.string(),
  leagueId: v.id("leagues"),
  seasonId: v.id("seasons"),
  teamId: v.id("teams"),
  playerIds: v.array(v.id("players")),
  activeAssignmentIds: v.array(v.id("rosterAssignments")),
});

async function deleteFixtureByKey(
  ctx: {
    db: {
      query: (table: string) => {
        withIndex: (name: string, fn: (q: any) => any) => {
          collect: () => Promise<any[]>;
        };
      };
      delete: (id: any) => Promise<void>;
    };
  },
  fixtureKey: string,
): Promise<number> {
  const leagueName = fixtureLeagueName(fixtureKey);
  const leagues = (await ctx.db
    .query("leagues")
    .withIndex("by_name", (q: any) => q.eq("name", leagueName))
    .collect()) as Array<{ _id: Id<"leagues"> }>;

  let deleted = 0;
  for (const league of leagues) {
    const [
      seasons,
      teams,
      players,
      assignments,
      auditRows,
      depthEntries,
    ] = await Promise.all([
      ctx.db
        .query("seasons")
        .withIndex("by_leagueId", (q: any) => q.eq("leagueId", league._id))
        .collect(),
      ctx.db
        .query("teams")
        .withIndex("by_leagueId", (q: any) => q.eq("leagueId", league._id))
        .collect(),
      ctx.db
        .query("players")
        .withIndex("by_leagueId", (q: any) => q.eq("leagueId", league._id))
        .collect(),
      ctx.db
        .query("rosterAssignments")
        .withIndex("by_leagueId_seasonId", (q: any) =>
          q.eq("leagueId", league._id),
        )
        .collect(),
      ctx.db
        .query("rosterAuditLog")
        .withIndex("by_leagueId_createdAt", (q: any) =>
          q.eq("leagueId", league._id),
        )
        .collect(),
      // depth chart rows aren't indexed on leagueId — walk via teams below
      Promise.resolve([] as Array<{ _id: Id<"depthChartEntries"> }>),
    ]);

    for (const row of assignments) {
      await ctx.db.delete(row._id);
      deleted += 1;
    }
    for (const row of auditRows) {
      await ctx.db.delete(row._id);
      deleted += 1;
    }
    for (const team of teams as Array<{ _id: Id<"teams"> }>) {
      const teamDepth = (await ctx.db
        .query("depthChartEntries")
        .withIndex("by_team_season", (q: any) => q.eq("teamId", team._id))
        .collect()) as Array<{ _id: Id<"depthChartEntries"> }>;
      for (const row of teamDepth) {
        await ctx.db.delete(row._id);
        deleted += 1;
      }
    }
    for (const row of players) {
      await ctx.db.delete(row._id);
      deleted += 1;
    }
    for (const row of teams) {
      await ctx.db.delete(row._id);
      deleted += 1;
    }
    for (const row of seasons) {
      await ctx.db.delete(row._id);
      deleted += 1;
    }
    void depthEntries;
    await ctx.db.delete(league._id);
    deleted += 1;
  }
  return deleted;
}

export const createRosterFixture = mutation({
  args: {
    fixtureKey: v.string(),
    clerkOrgId: v.union(v.string(), v.null()),
    teamName: v.optional(v.string()),
    rosterLimit: v.union(v.number(), v.null()),
    rosterLocked: v.optional(v.boolean()),
    seedActivePlayers: v.optional(v.number()),
    extraBenchPlayers: v.optional(v.number()),
    positionSlot: v.optional(v.string()),
  },
  returns: fixtureResultValidator,
  handler: async (ctx, args) => {
    assertSeedEnabled();

    await deleteFixtureByKey(ctx as any, args.fixtureKey);

    const teamName = args.teamName ?? "E2E Test Team";
    const positionSlot = args.positionSlot ?? "QB";
    const seedActive = args.seedActivePlayers ?? 0;
    const extraBench = args.extraBenchPlayers ?? 2;
    const rosterLocked = args.rosterLocked ?? false;

    const leagueId = await ctx.db.insert("leagues", {
      name: fixtureLeagueName(args.fixtureKey),
      orgId: args.clerkOrgId,
      isPublic: false,
      inviteToken: null,
    });

    const seasonId = await ctx.db.insert("seasons", {
      name: "E2E Season",
      leagueId,
      startDate: null,
      endDate: null,
      status: "active",
      rosterLocked,
    });

    const teamId = await ctx.db.insert("teams", {
      name: teamName,
      leagueId,
      divisionId: null,
      city: "Test City",
      stadium: "Test Stadium",
      foundedYear: null,
      location: "Test City, TS",
      logoUrl: null,
      rosterLimit: args.rosterLimit,
    });

    const totalPlayers = seedActive + extraBench;
    const playerIds: Id<"players">[] = [];
    for (let i = 0; i < totalPlayers; i++) {
      const playerId = await ctx.db.insert("players", {
        name: `E2E Player ${i + 1}`,
        leagueId,
        teamId,
        position: positionSlot,
        positionGroup: null,
        jerseyNumber: i + 1,
        dateOfBirth: null,
        status: "active",
        headshotUrl: null,
      });
      playerIds.push(playerId);
    }

    const assignedAt = new Date().toISOString();
    const activeAssignmentIds: Id<"rosterAssignments">[] = [];
    for (let i = 0; i < seedActive; i++) {
      const playerId = playerIds[i];
      const assignmentId = await ctx.db.insert("rosterAssignments", {
        seasonId,
        teamId,
        playerId,
        leagueId,
        depthRank: i + 1,
        positionSlot,
        status: "active",
        assignedAt,
        assignedBy: SEED_ACTOR,
      });
      activeAssignmentIds.push(assignmentId);
    }

    return {
      fixtureKey: args.fixtureKey,
      leagueId,
      seasonId,
      teamId,
      playerIds,
      activeAssignmentIds,
    };
  },
});

export const resetRosterFixture = mutation({
  args: { fixtureKey: v.string() },
  returns: v.object({ deleted: v.number() }),
  handler: async (ctx, args) => {
    assertSeedEnabled();
    const deleted = await deleteFixtureByKey(ctx as any, args.fixtureKey);
    return { deleted };
  },
});

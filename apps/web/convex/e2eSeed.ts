import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

/*
 * e2e seed fixtures (WSM-000139, fast-follow to WSM-000096).
 *
 * These mutations create/destroy real rows, so they are `internalMutation` —
 * NOT callable by an anonymous `ConvexHttpClient` over the public Internet
 * (anonymous calls get `404 FunctionPathNotFound`). The Playwright harness
 * (`e2e/helpers/seed-roster.ts`, `seed-schedule.ts`) reaches them with an
 * admin-keyed client (`CONVEX_ADMIN_KEY`), which is what authorizes internal
 * calls. `assertSeedEnabled()` is a second, defense-in-depth gate so even a
 * trusted caller can't seed a deployment where `CONVEX_ENABLE_E2E_SEED` is
 * unset (e.g. prod). See [[reference_convex_security_model]].
 */

const FIXTURE_LEAGUE_PREFIX = "E2E:";
const SEED_ACTOR = "e2e_seed_harness";

// Canonical read-only dataset (WSM-000187). Mirrors apps/web/e2e/helpers/
// test-data.ts EXACTLY — the data-dependent specs (team-detail, players,
// data-table, status-badges, seasons, divisions, leagues, dashboard-overview)
// assert on these names/jerseys/statuses. All 4 teams + 12 players + 3 seasons
// live in ONE league so the active-league-scoped pages (e.g. /dashboard/players
// asserts exactly 12) are deterministic. The league is named "National Football
// League" because divisions.spec/leagues.spec assert that literal name.
const CANONICAL_LEAGUE_NAME = "National Football League";
const CANONICAL_DIVISION_NAME = "League Division";

const CANONICAL_TEAMS = [
  { name: "Dallas Cowboys", city: "Dallas", stadium: "AT&T Stadium", foundedYear: 1960 },
  { name: "New England Patriots", city: "Foxborough", stadium: "Gillette Stadium", foundedYear: 1960 },
  { name: "LA Galaxy", city: "Los Angeles", stadium: "Dignity Health Sports Park", foundedYear: 1996 },
  { name: "Seattle Sounders FC", city: "Seattle", stadium: "Lumen Field", foundedYear: 2007 },
] as const;

const CANONICAL_PLAYERS = [
  { team: "Dallas Cowboys", name: "Dak Prescott", position: "QB", jersey: 4, status: "Active" },
  { team: "Dallas Cowboys", name: "CeeDee Lamb", position: "WR", jersey: 88, status: "Active" },
  { team: "Dallas Cowboys", name: "Micah Parsons", position: "LB", jersey: 11, status: "Injured" },
  { team: "New England Patriots", name: "Drake Maye", position: "QB", jersey: 10, status: "Active" },
  { team: "New England Patriots", name: "Hunter Henry", position: "TE", jersey: 85, status: "Active" },
  { team: "New England Patriots", name: "Christian Barmore", position: "DT", jersey: 90, status: "Inactive" },
  { team: "LA Galaxy", name: "Riqui Puig", position: "MF", jersey: 10, status: "Active" },
  { team: "LA Galaxy", name: "Dejan Joveljic", position: "FW", jersey: 9, status: "Active" },
  { team: "LA Galaxy", name: "Maya Yoshida", position: "DF", jersey: 4, status: "Injured" },
  { team: "Seattle Sounders FC", name: "Joao Paulo", position: "MF", jersey: 6, status: "Active" },
  { team: "Seattle Sounders FC", name: "Jordan Morris", position: "FW", jersey: 13, status: "Active" },
  { team: "Seattle Sounders FC", name: "Stefan Frei", position: "GK", jersey: 24, status: "Inactive" },
] as const;

const CANONICAL_SEASONS = [
  { name: "2025-2026 NFL Season", startDate: "2025-09-04", endDate: "2026-02-08", status: "Active" },
  { name: "2024-2025 NFL Season", startDate: "2024-09-05", endDate: "2025-02-09", status: "Completed" },
  { name: "2025 MLS Season", startDate: "2025-02-22", endDate: "2025-10-25", status: "Upcoming" },
] as const;

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
  depthChartEntryIds: v.array(v.id("depthChartEntries")),
});

// Cascade-delete a single league and every child row that references it.
// Shared by the fixture teardown (`deleteFixtureByKey`) and the canonical
// reset (`createCanonicalFixture`) — the canonical league additionally has
// `divisions`, which fixtures never create (so the extra query is a harmless
// no-op for fixture leagues). Returns the number of rows deleted.
async function cascadeDeleteLeague(
  ctx: any,
  leagueId: Id<"leagues">,
): Promise<number> {
  let deleted = 0;
  const [seasons, teams, players, assignments, auditRows, divisions] =
    await Promise.all([
      ctx.db
        .query("seasons")
        .withIndex("by_leagueId", (q: any) => q.eq("leagueId", leagueId))
        .collect(),
      ctx.db
        .query("teams")
        .withIndex("by_leagueId", (q: any) => q.eq("leagueId", leagueId))
        .collect(),
      ctx.db
        .query("players")
        .withIndex("by_leagueId", (q: any) => q.eq("leagueId", leagueId))
        .collect(),
      ctx.db
        .query("rosterAssignments")
        .withIndex("by_leagueId_seasonId", (q: any) =>
          q.eq("leagueId", leagueId),
        )
        .collect(),
      ctx.db
        .query("rosterAuditLog")
        .withIndex("by_leagueId_createdAt", (q: any) =>
          q.eq("leagueId", leagueId),
        )
        .collect(),
      ctx.db
        .query("divisions")
        .withIndex("by_leagueId", (q: any) => q.eq("leagueId", leagueId))
        .collect(),
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

  // Phase 3 cascade — drop any fixtures + gameResults attached to the league's
  // seasons before the parent rows go away (schedules e2e, WSM-000074).
  for (const season of seasons as Array<{ _id: Id<"seasons"> }>) {
    const seasonFixtures = (await ctx.db
      .query("fixtures")
      .withIndex("by_seasonId", (q: any) => q.eq("seasonId", season._id))
      .collect()) as Array<{ _id: Id<"fixtures"> }>;
    for (const fixture of seasonFixtures) {
      const results = (await ctx.db
        .query("gameResults")
        .withIndex("by_fixtureId", (q: any) => q.eq("fixtureId", fixture._id))
        .collect()) as Array<{ _id: Id<"gameResults"> }>;
      for (const row of results) {
        await ctx.db.delete(row._id);
        deleted += 1;
      }
      await ctx.db.delete(fixture._id);
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
  for (const row of divisions) {
    await ctx.db.delete(row._id);
    deleted += 1;
  }
  for (const row of seasons) {
    await ctx.db.delete(row._id);
    deleted += 1;
  }
  await ctx.db.delete(leagueId);
  deleted += 1;
  return deleted;
}

async function deleteFixtureByKey(
  ctx: any,
  fixtureKey: string,
): Promise<number> {
  const leagueName = fixtureLeagueName(fixtureKey);
  const leagues = (await ctx.db
    .query("leagues")
    .withIndex("by_name", (q: any) => q.eq("name", leagueName))
    .collect()) as Array<{ _id: Id<"leagues"> }>;

  let deleted = 0;
  for (const league of leagues) {
    deleted += await cascadeDeleteLeague(ctx, league._id);
  }
  return deleted;
}

export const createRosterFixture = internalMutation({
  args: {
    fixtureKey: v.string(),
    clerkOrgId: v.union(v.string(), v.null()),
    teamName: v.optional(v.string()),
    rosterLimit: v.union(v.number(), v.null()),
    rosterLocked: v.optional(v.boolean()),
    seedActivePlayers: v.optional(v.number()),
    extraBenchPlayers: v.optional(v.number()),
    positionSlot: v.optional(v.string()),
    // Depth-chart e2e (WSM-000197): also insert one depthChartEntries row per
    // active player (sortOrder = seed index) so the board renders a
    // deterministic initial order that reorders can be asserted against.
    seedDepthChartEntries: v.optional(v.boolean()),
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

    const depthChartEntryIds: Id<"depthChartEntries">[] = [];
    if (args.seedDepthChartEntries) {
      for (let i = 0; i < seedActive; i++) {
        const entryId = await ctx.db.insert("depthChartEntries", {
          teamId,
          seasonId,
          playerId: playerIds[i],
          positionSlot,
          sortOrder: i,
          updatedAt: assignedAt,
        });
        depthChartEntryIds.push(entryId);
      }
    }

    return {
      fixtureKey: args.fixtureKey,
      leagueId,
      seasonId,
      teamId,
      playerIds,
      activeAssignmentIds,
      depthChartEntryIds,
    };
  },
});

export const resetRosterFixture = internalMutation({
  args: { fixtureKey: v.string() },
  returns: v.object({ deleted: v.number() }),
  handler: async (ctx, args) => {
    assertSeedEnabled();
    const deleted = await deleteFixtureByKey(ctx as any, args.fixtureKey);
    return { deleted };
  },
});

/*
 * Schedule fixture seed (Sprint 7 / WSM-000074).
 *
 * Creates a league + active season + two teams so the e2e spec
 * has the inputs it needs to create a `fixtures` row.
 * Reuses `deleteFixtureByKey` for cleanup (which now cascades through
 * fixtures + gameResults).
 */

const scheduleFixtureResultValidator = v.object({
  fixtureKey: v.string(),
  leagueId: v.id("leagues"),
  seasonId: v.id("seasons"),
  homeTeamId: v.id("teams"),
  awayTeamId: v.id("teams"),
  homeTeamName: v.string(),
  awayTeamName: v.string(),
});

export const createScheduleFixture = internalMutation({
  args: {
    fixtureKey: v.string(),
    clerkOrgId: v.union(v.string(), v.null()),
    homeTeamName: v.optional(v.string()),
    awayTeamName: v.optional(v.string()),
  },
  returns: scheduleFixtureResultValidator,
  handler: async (ctx, args) => {
    assertSeedEnabled();
    await deleteFixtureByKey(ctx as any, args.fixtureKey);

    const homeTeamName = args.homeTeamName ?? "E2E Home Team";
    const awayTeamName = args.awayTeamName ?? "E2E Away Team";

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
      rosterLocked: false,
    });

    const homeTeamId = await ctx.db.insert("teams", {
      name: homeTeamName,
      leagueId,
      divisionId: null,
      city: "Home City",
      stadium: "Home Stadium",
      foundedYear: null,
      location: "Home City, HC",
      logoUrl: null,
      rosterLimit: 53,
    });

    const awayTeamId = await ctx.db.insert("teams", {
      name: awayTeamName,
      leagueId,
      divisionId: null,
      city: "Away City",
      stadium: "Away Stadium",
      foundedYear: null,
      location: "Away City, AC",
      logoUrl: null,
      rosterLimit: 53,
    });

    return {
      fixtureKey: args.fixtureKey,
      leagueId,
      seasonId,
      homeTeamId,
      awayTeamId,
      homeTeamName,
      awayTeamName,
    };
  },
});

/*
 * Canonical read-only dataset (WSM-000187).
 *
 * Seeds the fixed NFL/MLS dataset the data-dependent specs assert on into a
 * single league owned by the test org. Idempotent: any prior canonical league
 * owned by THIS org (matched by name) is cascade-deleted first, so re-running
 * is safe and deterministic. Scoped to `clerkOrgId` so it can never touch a
 * real "National Football League" in another org.
 *
 * Specs set the `activeLeagueId` cookie to the returned `leagueId` so the
 * active-league-scoped pages (teams/players/divisions/leagues) render exactly
 * this data; org-wide pages (overview/seasons) see it additively.
 */
const canonicalFixtureResultValidator = v.object({
  leagueId: v.id("leagues"),
  leagueName: v.string(),
  divisionId: v.id("divisions"),
  teamIds: v.array(v.id("teams")),
  seasonIds: v.array(v.id("seasons")),
  playerIds: v.array(v.id("players")),
});

export const createCanonicalFixture = internalMutation({
  args: { clerkOrgId: v.union(v.string(), v.null()) },
  returns: canonicalFixtureResultValidator,
  handler: async (ctx, args) => {
    assertSeedEnabled();

    // Idempotent reset — drop any prior canonical league owned by this org.
    const prior = (
      await ctx.db
        .query("leagues")
        .withIndex("by_name", (q: any) => q.eq("name", CANONICAL_LEAGUE_NAME))
        .collect()
    ).filter((l: { orgId: string | null }) => l.orgId === args.clerkOrgId);
    for (const league of prior) {
      await cascadeDeleteLeague(ctx, league._id);
    }

    const leagueId = await ctx.db.insert("leagues", {
      name: CANONICAL_LEAGUE_NAME,
      orgId: args.clerkOrgId,
      isPublic: false,
      inviteToken: null,
    });

    const divisionId = await ctx.db.insert("divisions", {
      name: CANONICAL_DIVISION_NAME,
      leagueId,
    });

    const teamIdByName = new Map<string, Id<"teams">>();
    const teamIds: Id<"teams">[] = [];
    for (const team of CANONICAL_TEAMS) {
      const teamId = await ctx.db.insert("teams", {
        name: team.name,
        leagueId,
        divisionId,
        city: team.city,
        stadium: team.stadium,
        foundedYear: team.foundedYear,
        // Distinct from `city` so an exact-text match on the city value
        // ("Dallas") doesn't also match the Location field (WSM-000187).
        location: `${team.city}, USA`,
        logoUrl: null,
        rosterLimit: 53,
      });
      teamIdByName.set(team.name, teamId);
      teamIds.push(teamId);
    }

    const playerIds: Id<"players">[] = [];
    for (const player of CANONICAL_PLAYERS) {
      const teamId = teamIdByName.get(player.team);
      if (!teamId) continue;
      const playerId = await ctx.db.insert("players", {
        name: player.name,
        leagueId,
        teamId,
        position: player.position,
        positionGroup: null,
        jerseyNumber: player.jersey,
        dateOfBirth: null,
        status: player.status,
        headshotUrl: null,
      });
      playerIds.push(playerId);
    }

    const seasonIds: Id<"seasons">[] = [];
    for (const season of CANONICAL_SEASONS) {
      const seasonId = await ctx.db.insert("seasons", {
        name: season.name,
        leagueId,
        startDate: season.startDate,
        endDate: season.endDate,
        status: season.status,
        rosterLocked: false,
      });
      seasonIds.push(seasonId);
    }

    return {
      leagueId,
      leagueName: CANONICAL_LEAGUE_NAME,
      divisionId,
      teamIds,
      seasonIds,
      playerIds,
    };
  },
});

export const resetCanonicalFixture = internalMutation({
  args: { clerkOrgId: v.union(v.string(), v.null()) },
  returns: v.object({ deleted: v.number() }),
  handler: async (ctx, args) => {
    assertSeedEnabled();
    const prior = (
      await ctx.db
        .query("leagues")
        .withIndex("by_name", (q: any) => q.eq("name", CANONICAL_LEAGUE_NAME))
        .collect()
    ).filter((l: { orgId: string | null }) => l.orgId === args.clerkOrgId);
    let deleted = 0;
    for (const league of prior) {
      deleted += await cascadeDeleteLeague(ctx, league._id);
    }
    return { deleted };
  },
});

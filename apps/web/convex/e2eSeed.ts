import { v, type Infer } from "convex/values";
import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { finalizeSeasonHistoryForSeason } from "./lib/historyFinalize";
import { computeWeeklyPollForSeason } from "./lib/weeklyPolls";
import { emitDynastyEvent } from "./lib/events";
import { finalizeSeasonRecapForSeason } from "./lib/seasonRecaps";

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

// Status values mirror the lowercase contract used everywhere else in the
// codebase (see apps/web/src/lib/season-view.ts findActiveSeason and
// apps/web/convex/sports.ts setActiveSeason). TitleCase statuses would make
// `findActiveSeason` miss the active row, hiding the "Open Active Season"
// shortcut on League Home (see #591 / #596). Roster statuses on players
// (above) remain TitleCase because they are a different domain.
const CANONICAL_SEASONS = [
  { name: "2025-2026 NFL Season", startDate: "2025-09-04", endDate: "2026-02-08", status: "active" },
  { name: "2024-2025 NFL Season", startDate: "2024-09-05", endDate: "2025-02-09", status: "completed" },
  { name: "2025 MLS Season", startDate: "2025-02-22", endDate: "2025-10-25", status: "upcoming" },
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
  // Cached season aggregates (F2, F3). A table left behind here leaks state
  // between e2e runs and produces order-dependent, flaky standings and stat
  // leader assertions.
  for (const season of seasons as Array<{ _id: Id<"seasons"> }>) {
    const records = (await ctx.db
      .query("seasonTeamRecords")
      .withIndex("by_seasonId", (q: any) => q.eq("seasonId", season._id))
      .collect()) as Array<{ _id: Id<"seasonTeamRecords"> }>;
    for (const row of records) {
      await ctx.db.delete(row._id);
      deleted += 1;
    }
    const aggregates = (await ctx.db
      .query("playerSeasonAggregates")
      .withIndex("by_seasonId", (q: any) => q.eq("seasonId", season._id))
      .collect()) as Array<{ _id: Id<"playerSeasonAggregates"> }>;
    for (const row of aggregates) {
      await ctx.db.delete(row._id);
      deleted += 1;
    }
    // Season awards (D2). Clear before players/coaches so no accolade from a
    // prior Playwright fixture can leak onto the next run's Overview pages.
    const awards = (await ctx.db
      .query("awards")
      .withIndex("by_seasonId", (q: any) => q.eq("seasonId", season._id))
      .collect()) as Array<{ _id: Id<"awards"> }>;
    for (const row of awards) {
      await ctx.db.delete(row._id);
      deleted += 1;
    }
    // Weekly polls (D3). The rankings JSON retains team ids, so it must be
    // removed before the fixture's teams and season are deleted.
    const weeklyPolls = (await ctx.db
      .query("weeklyPolls")
      .withIndex("by_seasonId", (q: any) => q.eq("seasonId", season._id))
      .collect()) as Array<{ _id: Id<"weeklyPolls"> }>;
    for (const row of weeklyPolls) {
      await ctx.db.delete(row._id);
      deleted += 1;
    }
    // D4 recap rows retain event ids in their ordered blocks.
    const recaps = (await ctx.db
      .query("seasonRecaps")
      .withIndex("by_seasonId", (q: any) => q.eq("seasonId", season._id))
      .collect()) as Array<{ _id: Id<"seasonRecaps"> }>;
    for (const row of recaps) {
      await ctx.db.delete(row._id);
      deleted += 1;
    }
    /*
     * Training ledgers (B6). Season-scoped rather than league-scoped, so they
     * are cleared here. A leaked row is doubly bad: it spends a later run's
     * budget before the coach arrives, and if it is still unapplied it lands
     * on whichever player inherits the id.
     */
    const training = (await ctx.db
      .query("playerTrainingAllocations")
      .withIndex("by_seasonId", (q: any) => q.eq("seasonId", season._id))
      .collect()) as Array<{ _id: Id<"playerTrainingAllocations"> }>;
    for (const row of training) {
      await ctx.db.delete(row._id);
      deleted += 1;
    }
  }
  // Persisted offseason phase machine (B1). Left behind, a row would carry one
  // run's phase into the next and make the stepper assertions order-dependent.
  const offseasonRows = (await ctx.db
    .query("offseasons")
    .withIndex("by_leagueId", (q: any) => q.eq("leagueId", leagueId))
    .collect()) as Array<{ _id: Id<"offseasons"> }>;
  for (const row of offseasonRows) {
    await ctx.db.delete(row._id);
    deleted += 1;
  }
  // Recruiting classes (B3). A prospect left behind is worse than stale data:
  // the class is generated once per season and then never regenerated, so a
  // leaked row would make a later run's board a mix of two classes, and a
  // prospect already signed by a deleted team would show as taken by nobody.
  const prospectRows = (await ctx.db
    .query("recruitProspects")
    .withIndex("by_leagueId", (q: any) => q.eq("leagueId", leagueId))
    .collect()) as Array<{ _id: Id<"recruitProspects"> }>;
  for (const row of prospectRows) {
    await ctx.db.delete(row._id);
    deleted += 1;
  }
  // Transfer windows (B4). A leaked row is worse than stale: the window is
  // generated once per season and never regenerated, so an old row would make
  // a later run's panel offer a player who belongs to a team that no longer
  // exists — and `resolveTransfer` would then move a ghost.
  const transferRows = (await ctx.db
    .query("transferEvents")
    .withIndex("by_leagueId", (q: any) => q.eq("leagueId", leagueId))
    .collect()) as Array<{ _id: Id<"transferEvents"> }>;
  for (const row of transferRows) {
    await ctx.db.delete(row._id);
    deleted += 1;
  }
  // Dynasty feed (F4) — league-scoped, so cleared once rather than per season.
  const events = (await ctx.db
    .query("dynastyEvents")
    .withIndex("by_leagueId_createdAt", (q: any) => q.eq("leagueId", leagueId))
    .collect()) as Array<{ _id: Id<"dynastyEvents"> }>;
  for (const row of events) {
    await ctx.db.delete(row._id);
    deleted += 1;
  }
  // Cross-season history (D1). Both tables are League-owned, so one indexed
  // pass clears every career and both the League/Team record-book scopes.
  const careerTotals = (await ctx.db
    .query("playerCareerTotals")
    .withIndex("by_leagueId", (q: any) => q.eq("leagueId", leagueId))
    .collect()) as Array<{ _id: Id<"playerCareerTotals"> }>;
  for (const row of careerTotals) {
    await ctx.db.delete(row._id);
    deleted += 1;
  }
  const programRecords = (await ctx.db
    .query("programRecords")
    .withIndex("by_leagueId_category_rank", (q: any) =>
      q.eq("leagueId", leagueId),
    )
    .collect()) as Array<{ _id: Id<"programRecords"> }>;
  for (const row of programRecords) {
    await ctx.db.delete(row._id);
    deleted += 1;
  }
  // Per-league Dynasty settings (F5). A row left behind would carry one spec's
  // toggles into the next run.
  const configRows = (await ctx.db
    .query("dynastyConfig")
    .withIndex("by_leagueId", (q: any) => q.eq("leagueId", leagueId))
    .collect()) as Array<{ _id: Id<"dynastyConfig"> }>;
  for (const row of configRows) {
    await ctx.db.delete(row._id);
    deleted += 1;
  }
  // Declared rivalries (A5). A rivalry left behind changes how later runs
  // simulate that matchup, and would make the rivalry admin spec pass on a
  // second run purely because the first run's row was still there.
  const rivalryRows = (await ctx.db
    .query("rivalries")
    .withIndex("by_leagueId", (q: any) => q.eq("leagueId", leagueId))
    .collect()) as Array<{ _id: Id<"rivalries"> }>;
  for (const row of rivalryRows) {
    await ctx.db.delete(row._id);
    deleted += 1;
  }
  // Player injuries (A4). An injury left behind makes a player unavailable to
  // every later run — the sim reads open rows for the season before it picks
  // participants — so a spec that simulates would silently sim a short roster
  // purely because an earlier spec's game hurt someone.
  for (const team of teams as Array<{ _id: Id<"teams"> }>) {
    const injuryRows = (await ctx.db
      .query("playerInjuries")
      .withIndex("by_teamId_seasonId", (q: any) => q.eq("teamId", team._id))
      .collect()) as Array<{ _id: Id<"playerInjuries"> }>;
    for (const row of injuryRows) {
      await ctx.db.delete(row._id);
      deleted += 1;
    }
  }
  // Team programs (A6). A stored scheme changes how every later run simulates
  // that team, so leaving one behind would make a distribution assertion depend
  // on which spec ran first.
  for (const team of teams as Array<{ _id: Id<"teams"> }>) {
    const programRows = (await ctx.db
      .query("teamSeasonPrograms")
      .withIndex("by_teamId", (q: any) => q.eq("teamId", team._id))
      .collect()) as Array<{ _id: Id<"teamSeasonPrograms"> }>;
    for (const row of programRows) {
      await ctx.db.delete(row._id);
      deleted += 1;
    }
  }
  // Coaches and career rows (C1). A leaked head coach would change Staff card
  // counts and Coach Home assertions on the next run.
  const coachRows = (await ctx.db
    .query("coaches")
    .withIndex("by_leagueId", (q: any) => q.eq("leagueId", leagueId))
    .collect()) as Array<{ _id: Id<"coaches"> }>;
  for (const coach of coachRows) {
    const seasonRows = (await ctx.db
      .query("coachSeasons")
      .withIndex("by_coach_season", (q: any) => q.eq("coachId", coach._id))
      .collect()) as Array<{ _id: Id<"coachSeasons"> }>;
    for (const row of seasonRows) {
      await ctx.db.delete(row._id);
      deleted += 1;
    }
    await ctx.db.delete(coach._id);
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
      const gameplanRows = (await ctx.db
        .query("fixtureTeamGameplans")
        .withIndex("by_fixtureId", (q: any) => q.eq("fixtureId", fixture._id))
        .collect()) as Array<{ _id: Id<"fixtureTeamGameplans"> }>;
      for (const row of gameplanRows) {
        await ctx.db.delete(row._id);
        deleted += 1;
      }
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

/**
 * D1 route fixture: seed a league-wide row plus one Team-scoped row for BOTH
 * schedule-fixture teams. The route spec can therefore prove the view switcher
 * renders each program without completing/simulating a season.
 */
export const seedHistoryFixture = internalMutation({
  args: {
    leagueId: v.id("leagues"),
    seasonId: v.id("seasons"),
    homeTeamId: v.id("teams"),
    awayTeamId: v.id("teams"),
  },
  returns: v.object({ created: v.number() }),
  handler: async (ctx, args) => {
    assertSeedEnabled();
    const [season, homeTeam, awayTeam] = await Promise.all([
      ctx.db.get(args.seasonId),
      ctx.db.get(args.homeTeamId),
      ctx.db.get(args.awayTeamId),
    ]);
    if (
      !season ||
      season.leagueId !== args.leagueId ||
      !homeTeam ||
      homeTeam.leagueId !== args.leagueId ||
      !awayTeam ||
      awayTeam.leagueId !== args.leagueId
    ) {
      throw new Error("history_fixture_scope_mismatch");
    }

    const prior = await ctx.db
      .query("programRecords")
      .withIndex("by_leagueId_category_rank", (q) =>
        q.eq("leagueId", args.leagueId),
      )
      .collect();
    for (const row of prior) await ctx.db.delete(row._id);

    const now = new Date().toISOString();
    const teams = [
      { teamId: args.homeTeamId, value: 9, leagueRank: 1 },
      { teamId: args.awayTeamId, value: 8, leagueRank: 2 },
    ];
    let created = 0;
    for (const team of teams) {
      const stableKey = [
        "season",
        "teamWins",
        args.seasonId,
        team.teamId,
        "team",
      ].join(":");
      await ctx.db.insert("programRecords", {
        leagueId: args.leagueId,
        category: "teamWins",
        span: "season",
        rank: team.leagueRank,
        value: team.value,
        holderTeamId: team.teamId,
        seasonId: args.seasonId,
        stableKey,
        updatedAt: now,
      });
      await ctx.db.insert("programRecords", {
        leagueId: args.leagueId,
        teamId: team.teamId,
        category: "teamWins",
        span: "season",
        rank: 1,
        value: team.value,
        holderTeamId: team.teamId,
        seasonId: args.seasonId,
        stableKey,
        updatedAt: now,
      });
      created += 2;
    }
    return { created };
  },
});

/**
 * D2 route fixture: seed one award candidate and one head coach for BOTH
 * schedule-fixture teams, then run the real season-history finalizer.
 */
export const seedAwardsFixture = internalMutation({
  args: {
    leagueId: v.id("leagues"),
    seasonId: v.id("seasons"),
    homeTeamId: v.id("teams"),
    awayTeamId: v.id("teams"),
  },
  returns: v.object({
    winnerPlayerId: v.id("players"),
    awardsCreated: v.number(),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{
    winnerPlayerId: Id<"players">;
    awardsCreated: number;
  }> => {
    assertSeedEnabled();
    const [season, homeTeam, awayTeam] = await Promise.all([
      ctx.db.get(args.seasonId),
      ctx.db.get(args.homeTeamId),
      ctx.db.get(args.awayTeamId),
    ]);
    if (
      !season ||
      season.leagueId !== args.leagueId ||
      !homeTeam ||
      homeTeam.leagueId !== args.leagueId ||
      !awayTeam ||
      awayTeam.leagueId !== args.leagueId
    ) {
      throw new Error("awards_fixture_scope_mismatch");
    }

    const divisionId = await ctx.db.insert("divisions", {
      name: "E2E Awards Conference",
      leagueId: args.leagueId,
    });
    await Promise.all([
      ctx.db.patch(args.homeTeamId, { divisionId }),
      ctx.db.patch(args.awayTeamId, { divisionId }),
    ]);

    const now = new Date().toISOString();
    const candidates = [
      {
        teamId: args.homeTeamId,
        playerName: "Zed Awards",
        coachName: "Zed Coach",
      },
      {
        teamId: args.awayTeamId,
        playerName: "Aaron Awards",
        coachName: "Aaron Coach",
      },
    ];
    let winnerPlayerId: Id<"players"> | null = null;

    for (const [index, candidate] of candidates.entries()) {
      const playerId = await ctx.db.insert("players", {
        name: candidate.playerName,
        leagueId: args.leagueId,
        teamId: candidate.teamId,
        position: "QB",
        positionGroup: "QB",
        jerseyNumber: index + 10,
        dateOfBirth: null,
        status: "active",
        headshotUrl: null,
        grade: 9,
      });
      if (candidate.playerName === "Aaron Awards") {
        winnerPlayerId = playerId;
      }
      await ctx.db.insert("playerSeasonAggregates", {
        leagueId: args.leagueId,
        seasonId: args.seasonId,
        teamId: candidate.teamId,
        playerId,
        position: "QB",
        positionGroup: "QB",
        playerName: candidate.playerName,
        newcomerEligible: true,
        gamesPlayed: 10,
        totalsJson: JSON.stringify({
          passing: { yards: 2_000, td: 20, int: 5 },
        }),
        updatedAt: now,
      });
      await ctx.db.insert("seasonTeamRecords", {
        leagueId: args.leagueId,
        seasonId: args.seasonId,
        teamId: candidate.teamId,
        divisionId,
        wins: 8,
        losses: 2,
        ties: 0,
        pointsFor: 300,
        pointsAgainst: 200,
        divisionWins: 4,
        divisionLosses: 1,
        divisionTies: 0,
        headToHeadJson: "{}",
        streak: 1,
        lastResults: ["W"],
        gamesCounted: 10,
        updatedAt: now,
      });
      await ctx.db.insert("coaches", {
        leagueId: args.leagueId,
        teamId: candidate.teamId,
        displayName: candidate.coachName,
        role: "head_coach",
        status: "ai",
        archetype: "program_builder",
        prestige: 50,
        createdAt: now,
        updatedAt: now,
      });
    }

    await finalizeSeasonHistoryForSeason(ctx, args.seasonId);
    const awards = await ctx.db
      .query("awards")
      .withIndex("by_seasonId", (q: any) =>
        q.eq("seasonId", args.seasonId),
      )
      .collect();
    if (!winnerPlayerId) throw new Error("awards_fixture_winner_missing");
    return { winnerPlayerId, awardsCreated: awards.length };
  },
});

/**
 * D3 route fixture: seed one persisted record for BOTH schedule-fixture teams,
 * then run the real weekly-poll materializer.
 */
const seedRankingsFixtureResultValidator = v.object({
  rankingsCreated: v.number(),
});
type SeedRankingsFixtureResult = Infer<
  typeof seedRankingsFixtureResultValidator
>;

export const seedRankingsFixture = internalMutation({
  args: {
    leagueId: v.id("leagues"),
    seasonId: v.id("seasons"),
    homeTeamId: v.id("teams"),
    awayTeamId: v.id("teams"),
  },
  returns: seedRankingsFixtureResultValidator,
  handler: async (
    ctx,
    args,
  ): Promise<SeedRankingsFixtureResult> => {
    assertSeedEnabled();
    const [season, homeTeam, awayTeam] = await Promise.all([
      ctx.db.get(args.seasonId),
      ctx.db.get(args.homeTeamId),
      ctx.db.get(args.awayTeamId),
    ]);
    if (
      !season ||
      season.leagueId !== args.leagueId ||
      !homeTeam ||
      homeTeam.leagueId !== args.leagueId ||
      !awayTeam ||
      awayTeam.leagueId !== args.leagueId
    ) {
      throw new Error("rankings_fixture_scope_mismatch");
    }

    const now = new Date().toISOString();
    const records = [
      {
        teamId: args.homeTeamId,
        opponentTeamId: args.awayTeamId,
        wins: 1,
        losses: 0,
        pointsFor: 28,
        pointsAgainst: 14,
        result: "W",
      },
      {
        teamId: args.awayTeamId,
        opponentTeamId: args.homeTeamId,
        wins: 0,
        losses: 1,
        pointsFor: 14,
        pointsAgainst: 28,
        result: "L",
      },
    ] as const;
    for (const record of records) {
      await ctx.db.insert("seasonTeamRecords", {
        leagueId: args.leagueId,
        seasonId: args.seasonId,
        teamId: record.teamId,
        divisionId: null,
        wins: record.wins,
        losses: record.losses,
        ties: 0,
        pointsFor: record.pointsFor,
        pointsAgainst: record.pointsAgainst,
        divisionWins: 0,
        divisionLosses: 0,
        divisionTies: 0,
        headToHeadJson: JSON.stringify({
          [record.opponentTeamId]: {
            w: record.wins,
            l: record.losses,
            t: 0,
          },
        }),
        streak: record.result === "W" ? 1 : -1,
        lastResults: [record.result],
        gamesCounted: 1,
        updatedAt: now,
      });
    }
    const result = await computeWeeklyPollForSeason(ctx, {
      leagueId: args.leagueId,
      seasonId: args.seasonId,
      week: 1,
    });
    return { rankingsCreated: result.rankings };
  },
});

const seedNewsRecapFixtureResultValidator = v.object({
  incompleteSeasonId: v.id("seasons"),
  eventsCreated: v.number(),
  blocksCreated: v.number(),
});
type SeedNewsRecapFixtureResult = Infer<
  typeof seedNewsRecapFixtureResultValidator
>;

/**
 * D4 route fixture: emit headlines for both schedule-fixture teams, persist the
 * completed season's real recap, and add one active season for the link gate.
 */
export const seedNewsRecapFixture = internalMutation({
  args: {
    leagueId: v.id("leagues"),
    seasonId: v.id("seasons"),
    homeTeamId: v.id("teams"),
    awayTeamId: v.id("teams"),
  },
  returns: seedNewsRecapFixtureResultValidator,
  handler: async (
    ctx,
    args,
  ): Promise<SeedNewsRecapFixtureResult> => {
    assertSeedEnabled();
    const [season, homeTeam, awayTeam] = await Promise.all([
      ctx.db.get(args.seasonId),
      ctx.db.get(args.homeTeamId),
      ctx.db.get(args.awayTeamId),
    ]);
    if (
      !season ||
      season.leagueId !== args.leagueId ||
      !homeTeam ||
      homeTeam.leagueId !== args.leagueId ||
      !awayTeam ||
      awayTeam.leagueId !== args.leagueId
    ) {
      throw new Error("news_recap_fixture_scope_mismatch");
    }

    const emitted = await Promise.all([
      emitDynastyEvent(ctx, {
        leagueId: args.leagueId,
        seasonId: args.seasonId,
        week: 2,
        teamId: args.homeTeamId,
        dedupeKey: `e2e_news_game:${args.seasonId}`,
        narrative: {
          type: "game_final",
          winnerName: homeTeam.name,
          loserName: awayTeam.name,
          winnerScore: 24,
          loserScore: 21,
          tie: false,
          week: 2,
        },
      }),
      emitDynastyEvent(ctx, {
        leagueId: args.leagueId,
        seasonId: args.seasonId,
        teamId: args.awayTeamId,
        dedupeKey: `e2e_news_transfer:${args.seasonId}`,
        narrative: {
          type: "transfer_retained",
          playerName: "E2E News Captain",
          teamName: awayTeam.name,
          position: "QB",
        },
      }),
      emitDynastyEvent(ctx, {
        leagueId: args.leagueId,
        seasonId: args.seasonId,
        teamId: args.homeTeamId,
        dedupeKey: `e2e_news_award:${args.seasonId}`,
        narrative: {
          type: "award_won",
          recipientName: "E2E News Star",
          awardName: "Player of the Year",
          positionGroup: "RB",
        },
      }),
    ]);
    const recap = await finalizeSeasonRecapForSeason(ctx, args.seasonId);
    await ctx.db.patch(args.seasonId, { status: "completed" });
    const incompleteSeasonId = await ctx.db.insert("seasons", {
      name: "E2E Current Season",
      leagueId: args.leagueId,
      startDate: null,
      endDate: null,
      status: "active",
      rosterLocked: false,
    });

    return {
      incompleteSeasonId,
      eventsCreated: emitted.filter((result) => result.created).length,
      blocksCreated: recap.blocksWritten,
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

/*
 * Seed a recruiting class onto an existing season (B3).
 *
 * Recruiting classes are normally built by the `prospects_generated` rollover
 * stage, which needs a completed season to roll over FROM. Simulating one to a
 * champion just to see a board would make the recruiting spec the slowest in
 * the suite and would couple it to every earlier slice's behaviour.
 *
 * Routed through `internal.dynasty.createProspectClass` rather than inserting
 * rows here, so the seeded board is built by the SAME code path production
 * uses — including the level-0 band. A fixture that wrote its own rows could
 * drift from the real one and quietly make the spec assert nothing.
 */
export const seedProspectClass = internalMutation({
  args: {
    seasonId: v.id("seasons"),
    count: v.optional(v.number()),
  },
  returns: v.object({ created: v.number(), alreadyExisted: v.boolean() }),
  handler: async (ctx, args): Promise<{ created: number; alreadyExisted: boolean }> => {
    assertSeedEnabled();
    const season = await ctx.db.get(args.seasonId);
    if (!season) throw new Error("season_not_found");

    const count = Math.max(1, Math.min(args.count ?? 4, 20));
    const positions = ["QB", "RB", "WR", "OL", "DL", "LB", "DB"];
    const prospects = Array.from({ length: count }, (_, i) => {
      const position = positions[i % positions.length] ?? "WR";
      // Fixed ratings: a spec that asserted on a range needs the range to be
      // the same on every run.
      const base = 55 + ((i * 7) % 30);
      return {
        name: `E2E Prospect ${i + 1}`,
        position,
        positionGroup: position,
        archetype: "Athlete",
        hometown: "Acworth, GA",
        trueAttributesJson: JSON.stringify({
          SPD: base + 4,
          STR: base - 3,
          AWR: base,
          ACC: base + 1,
          AGI: base - 1,
        }),
        trueOverall: base,
        potentialTier: "steady",
      };
    });

    return ctx.runMutation(internal.dynasty.createProspectClass, {
      leagueId: season.leagueId,
      seasonId: args.seasonId,
      prospects,
    });
  },
});

/*
 * Stack a team with buried players so a transfer window has somebody in it (B4).
 *
 * The slate is a seeded roll against `transferOutLikelihood`, which is driven
 * by depth rank and rating. A realistic fixture roster would make the spec
 * depend on the RNG landing well; six high-rated juniors behind one starter
 * makes it a certainty without touching the production path — the window is
 * still opened by the real mutation, through the real button.
 */
export const seedTransferCandidates = internalMutation({
  args: {
    seasonId: v.id("seasons"),
    teamId: v.id("teams"),
    count: v.optional(v.number()),
  },
  returns: v.object({ created: v.number() }),
  handler: async (ctx, args) => {
    assertSeedEnabled();
    const season = await ctx.db.get(args.seasonId);
    if (!season) throw new Error("season_not_found");
    const team = await ctx.db.get(args.teamId);
    if (!team) throw new Error("team_not_found");

    const count = Math.max(1, Math.min(args.count ?? 6, 20));
    const now = new Date().toISOString();
    let created = 0;
    for (let i = 0; i < count; i++) {
      const playerId = await ctx.db.insert("players", {
        name: `E2E Transfer ${i + 1}`,
        leagueId: season.leagueId,
        teamId: args.teamId,
        position: "WR",
        positionGroup: null,
        jerseyNumber: null,
        dateOfBirth: null,
        status: "active",
        headshotUrl: null,
        experienceYears: null,
        grade: 11,
        squad: "Varsity",
        hometown: null,
        synthetic: true,
      });
      await ctx.db.insert("rosterAssignments", {
        seasonId: args.seasonId,
        teamId: args.teamId,
        playerId,
        leagueId: season.leagueId,
        // Rank 1 is the starter; everyone behind him is a transfer candidate.
        depthRank: i + 1,
        positionSlot: "WR",
        status: "active",
        assignedAt: now,
        assignedBy: SEED_ACTOR,
      });
      await ctx.db.insert("playerAttributes", {
        playerId,
        seasonId: args.seasonId,
        positionGroup: "WR",
        attributesJson: JSON.stringify({ SPD: 95 }),
        pffSourceJson: null,
        maddenSourceJson: null,
        pffWeight: 0,
        maddenWeight: 0,
        weightedOverall: 95,
        ingestedAt: now,
      });
      created += 1;
    }
    return { created };
  },
});

/**
 * Seed a roster the B5 panel has an obvious decision about.
 *
 * One weak senior holding the starting job and `count` strong sophomores on JV
 * behind him, so `recommendPromotions` has a comparative case to make. Grades
 * are explicit because every rule in B5 turns on them — a roster of
 * grade-less players would make the panel correctly show nothing.
 */
export const seedRosterMoveCandidates = internalMutation({
  args: {
    seasonId: v.id("seasons"),
    teamId: v.id("teams"),
    count: v.optional(v.number()),
  },
  returns: v.object({ created: v.number() }),
  handler: async (ctx, args) => {
    assertSeedEnabled();
    const season = await ctx.db.get(args.seasonId);
    if (!season) throw new Error("season_not_found");
    const team = await ctx.db.get(args.teamId);
    if (!team) throw new Error("team_not_found");

    const count = Math.max(1, Math.min(args.count ?? 3, 20));
    const now = new Date().toISOString();
    let created = 0;

    async function addPlayer(spec: {
      name: string;
      grade: number;
      squad: string;
      overall: number;
      depthRank: number;
    }) {
      const playerId = await ctx.db.insert("players", {
        name: spec.name,
        leagueId: season!.leagueId,
        teamId: args.teamId,
        position: "WR",
        positionGroup: "WR",
        jerseyNumber: null,
        dateOfBirth: null,
        status: "active",
        headshotUrl: null,
        experienceYears: null,
        grade: spec.grade,
        squad: spec.squad,
        hometown: null,
        synthetic: true,
      });
      await ctx.db.insert("rosterAssignments", {
        seasonId: args.seasonId,
        teamId: args.teamId,
        playerId,
        leagueId: season!.leagueId,
        depthRank: spec.depthRank,
        positionSlot: "WR",
        status: "active",
        assignedAt: now,
        assignedBy: SEED_ACTOR,
      });
      await ctx.db.insert("depthChartEntries", {
        teamId: args.teamId,
        seasonId: args.seasonId,
        playerId,
        positionSlot: "WR",
        sortOrder: spec.depthRank - 1,
        updatedAt: now,
      });
      await ctx.db.insert("playerAttributes", {
        playerId,
        seasonId: args.seasonId,
        positionGroup: "WR",
        attributesJson: JSON.stringify({
          SPD: spec.overall,
          AGI: spec.overall,
          ACC: spec.overall,
          STR: 55,
          AWR: 60,
          STA: 70,
        }),
        pffSourceJson: null,
        maddenSourceJson: null,
        pffWeight: 0,
        maddenWeight: 0,
        weightedOverall: spec.overall,
        ingestedAt: now,
      });
      created += 1;
    }

    // The incumbent: a senior who cannot be sent down, holding the job.
    await addPlayer({
      name: "E2E Starter Senior",
      grade: 12,
      squad: "Varsity",
      overall: 62,
      depthRank: 1,
    });
    for (let i = 0; i < count; i++) {
      await addPlayer({
        name: `E2E JV Sophomore ${i + 1}`,
        grade: 10,
        squad: "JV",
        overall: 88 - i,
        depthRank: i + 2,
      });
    }

    return { created };
  },
});

/** Seed AI head coaches for an e2e fixture league (C1). */
export const seedAiHeadCoaches = internalMutation({
  args: { leagueId: v.id("leagues") },
  returns: v.object({
    coachesCreated: v.number(),
    coachSeasonsCreated: v.number(),
    teamsScanned: v.number(),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{
    coachesCreated: number;
    coachSeasonsCreated: number;
    teamsScanned: number;
  }> => {
    assertSeedEnabled();
    return ctx.runMutation(internal.program.seedAiHeadCoachesForLeague, {
      leagueId: args.leagueId,
    });
  },
});

/** E2E-only: grant spendable skill points on a coach (C4). */
export const grantCoachSkillPoints = internalMutation({
  args: {
    coachId: v.id("coaches"),
    skillPoints: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    assertSeedEnabled();
    const points = Math.max(0, Math.floor(args.skillPoints));
    await ctx.db.patch(args.coachId, { skillPoints: points });
    return null;
  },
});

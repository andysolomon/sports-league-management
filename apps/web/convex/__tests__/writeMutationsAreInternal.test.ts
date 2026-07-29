/// <reference types="vite/client" />
import { describe, it, expect } from "vitest";
import { api, internal } from "../_generated/api";

/*
 * Security regression guard (WSM-000096).
 *
 * All sports.ts WRITE mutations must be registered as `internalMutation` /
 * `internalMutationGeneric` so they are NOT callable by an anonymous
 * `ConvexHttpClient` over the public Internet — only by trusted server code
 * holding the deploy/admin key (data-api.ts, ingest scripts).
 *
 * Enforcement is COMPILE-TIME via tsc (which CI runs as `type-check`; vitest is
 * not in CI). The `internal.sports.*` accesses must type-check (proves they are
 * internal), and the `api.sports.*` write accesses are `@ts-expect-error` — if
 * any write is reverted to a public `mutation`, it reappears on the typed `api`
 * object, the suppressed error disappears, and tsc fails on the now-unused
 * `@ts-expect-error`. Public READ queries must remain on `api`.
 */

// --- Writes MUST be internal (these references must exist) ---
void internal.sports.createTeam;
void internal.sports.updateTeam;
void internal.sports.deleteTeam;
void internal.sports.createPlayer;
void internal.sports.deletePlayer;
void internal.sports.upsertPlayer;
void internal.sports.deleteLeague;
void internal.sports.deleteLeagueBatch;
void internal.sports.upsertSeason;
void internal.sports.updateSeason;
void internal.sports.setActiveSeason;
void internal.sports.deleteSeason;
void internal.sports.clearSeasonPlayerAttributes;
void internal.sports.ingestMaddenRatingsBatch;
void internal.sports.ingestPlayerAttributesBatch;
void internal.sports.rolloverGraduateAndAdvancePlayers;
void internal.sports.removePlayersFromSeasonRoster;
void internal.sports.releasePlayerToFreeAgency;
void internal.sports.signFreeAgent;
void internal.sports.startDraft;
void internal.sports.makeDraftPick;
void internal.sports.endDraft;
void internal.sports.updatePlayerAttributes;
void internal.sports.setOrgMemberRole;
void internal.sports.updateDivision;
void internal.sports.deleteDivision;
void internal.sports.setLeaguePublic;
void internal.sports.recordGameResult;
void internal.sports.rebuildSeasonTeamRecords;
void internal.sports.rebuildSeasonPlayerAggregates;
void internal.dynasty.setDynastyConfig;
void internal.program.setTeamProgram;
void internal.program.seedAiHeadCoachesForLeague;
void internal.program.spendCoachSkillPoints;
void internal.sports.assignPlayerToRoster;
void internal.sports.forkTeamToWorkspace;
void internal.sports.forkDivisionToWorkspace;
void internal.sports.forkConferenceToWorkspace;
void internal.sports.unforkTeamFromWorkspace;
void internal.sports.createGameStream;
void internal.sports.updateGameStreamStatus;
void internal.sports.upsertPlayerGameStats;
void internal.sports.bulkUpsertPlayerGameStats;
void internal.sports.upsertGamePlayLog;
void internal.sports.deletePlayerGameStats;
void internal.sports.startLiveGame;
void internal.sports.addLiveScore;
void internal.sports.setLiveScore;
void internal.sports.updateLiveState;
void internal.sports.endLiveGame;

// --- Writes MUST NOT be on the public API (each access must be a type error) ---
// @ts-expect-error createTeam is internal, not public
void api.sports.createTeam;
// @ts-expect-error deleteTeam is internal, not public
void api.sports.deleteTeam;
// @ts-expect-error deletePlayer is internal, not public
void api.sports.deletePlayer;
// @ts-expect-error deleteLeague is internal, not public
void api.sports.deleteLeague;
// @ts-expect-error clearSeasonPlayerAttributes is internal, not public
void api.sports.clearSeasonPlayerAttributes;
// @ts-expect-error ingestMaddenRatingsBatch is internal, not public
void api.sports.ingestMaddenRatingsBatch;
// @ts-expect-error updatePlayerAttributes is internal, not public
void api.sports.updatePlayerAttributes;
// @ts-expect-error setOrgMemberRole is internal, not public
void api.sports.setOrgMemberRole;
// @ts-expect-error forkDivisionToWorkspace is internal, not public
void api.sports.forkDivisionToWorkspace;
// @ts-expect-error forkConferenceToWorkspace is internal, not public
void api.sports.forkConferenceToWorkspace;
// @ts-expect-error unforkTeamFromWorkspace is internal, not public
void api.sports.unforkTeamFromWorkspace;
// @ts-expect-error createGameStream is internal, not public
void api.sports.createGameStream;
// @ts-expect-error updateGameStreamStatus is internal, not public
void api.sports.updateGameStreamStatus;
// @ts-expect-error upsertPlayerGameStats is internal, not public
void api.sports.upsertPlayerGameStats;
// @ts-expect-error deletePlayerGameStats is internal, not public
void api.sports.deletePlayerGameStats;
// @ts-expect-error startLiveGame is internal, not public
void api.sports.startLiveGame;
// @ts-expect-error addLiveScore is internal, not public
void api.sports.addLiveScore;
// @ts-expect-error endLiveGame is internal, not public
void api.sports.endLiveGame;

// --- Public READ queries must remain public (these must exist on api) ---
void api.sports.listTeams;
void api.sports.listConferences;
void api.sports.getPlayer;
void api.sports.listPublicLeagues;
void api.sports.computeStandingsPublic;
void api.sports.getPlayerDevelopmentPublic;

/*
 * EXHAUSTIVE backstop (WSM-000096 hardening).
 *
 * The per-name lists above protect only the writes someone remembered to add.
 * This catches the rest: every sports.ts write is an `internalMutation`, so it
 * never appears on the public `api.sports` object — therefore `api.sports` must
 * expose ONLY read queries. `AllowedPublicSportsReads` enumerates them; if a
 * future write is registered as a public `mutation`, its name joins
 * `keyof typeof api.sports`, falls outside the allow-list, and
 * `LeakedPublicSportsWrites` becomes a non-`never` union that fails the
 * assignment below at compile time (tsc names the leaked function). This is the
 * exact regression that wrote 1,637 unauthenticated rows to prod — now it can't
 * merge undetected.
 *
 * Adding a genuinely-public READ query? Add its name here — a deliberate,
 * security-reviewed act — to keep the backstop green.
 */
type AllowedPublicSportsReads =
  | "computeDivisionStandings"
  | "computeSeasonSprt"
  | "computeStandings"
  | "computeStandingsPublic"
  | "getDraft"
  | "getDepthChartByTeamSeason"
  | "getDivision"
  | "getFixture"
  | "getGamePlayLog"
  | "getLeague"
  | "getLeagueByInviteToken"
  | "getLeagueByName"
  | "getLeagueClaimable"
  | "getLeagueInviteInfo"
  | "getLeagueOrgId"
  | "getLeagueVisibility"
  | "getLiveGameState"
  | "getOrgForkedSourceTeamIds"
  | "getOrgMemberRole"
  | "getPlayer"
  | "getPlayoffBracket"
  | "getPlayerDevelopment"
  | "getPlayerDevelopmentPublic"
  | "getPlayerGameStatsByFixture"
  | "getPlayerCareerTotals"
  | "getPlayerMaddenRating"
  | "getPlayerSeasonAttributes"
  | "getPlayerSeasonTotals"
  | "getPublicLiveGameState"
  | "getActiveStreamCountForLeague"
  | "getResultByFixture"
  | "getRosterAssignmentHistory"
  | "getRosterBySeasonTeam"
  | "getSeason"
  | "getSeasonAttributesByPosition"
  | "getSeasonStatLeaders"
  | "getSeasonStatLeadersPublic"
  | "getStreamByFixture"
  | "getSyncConfig"
  | "getTeam"
  | "getTeamAttributeSnapshots"
  | "getTeamLeagueId"
  | "getTeamMaddenOveralls"
  | "getTeamOwnerOrgId"
  | "getTeamRosterLimitStatus"
  | "getVisibleLeagueContext"
  | "healthSummary"
  | "listClipsByFixture"
  | "listConferences"
  | "listDynastyEvents"
  | "listDivisions"
  | "listFixturesBySeason"
  | "listFreeAgents"
  | "listLeagues"
  | "listOrgMemberRoles"
  | "listPlayers"
  | "listPlayersByTeam"
  | "listPublicLeagues"
  | "listResultsBySeason"
  | "listSeasonPlayerAttributes"
  | "listSeasons"
  | "listTeams"
  | "listTeamsByLeague";

type LeakedPublicSportsWrites = Exclude<
  keyof typeof api.sports,
  AllowedPublicSportsReads
>;

// If any write leaks onto the public API, the right-hand `true` is no longer
// assignable to the (now non-`never`) leaked-name union and tsc fails here.
const _noLeakedPublicSportsWrites: LeakedPublicSportsWrites extends never
  ? true
  : LeakedPublicSportsWrites = true;
void _noLeakedPublicSportsWrites;

/*
 * Dynasty Mode modules (F1) — same backstop, one per module.
 *
 * `convex/{dynasty,sim,program,history}.ts` are where every Dynasty Mode write
 * lands. They start empty apart from a readiness probe, so each allow-list is a
 * single name today — and that is exactly the point: the FIRST write added to
 * any of these modules is guarded from its first commit, instead of the guard
 * being retrofitted after a leak. Adding a genuinely-public READ query means
 * adding its name below, which is a deliberate, security-reviewed act.
 *
 * Note these unions are NOT interchangeable with `AllowedPublicSportsReads`.
 * Each `Exclude` is keyed to its own module, so a write leaking onto
 * `api.program` cannot be masked by an allow-list entry on another module.
 */
void api.dynasty.moduleStatus;
void api.sim.moduleStatus;
void api.program.moduleStatus;
void api.history.moduleStatus;

type AllowedPublicDynastyReads =
  | "moduleStatus"
  | "getDynastyConfig"
  | "getOffseason"
  /*
   * B3. Public, and safe to be public, because the hidden three
   * (`trueAttributesJson`, `trueOverall`, `potentialTier`) are absent from its
   * `returns:` validator — see `prospectsHideTruth.test.ts`, which is the test
   * that makes this line reviewable rather than trusting.
   */
  | "listProspects"
  /*
   * B4. Public because the transfer window is public information — every
   * program can see who is looking. What is NOT public is acting on it:
   * `resolveTransfer` is an internalMutation behind a per-`teamId` gate.
   */
  | "listTransfers"
  /*
   * B5. A roster is already readable through the team and roster pages; this
   * query returns the same players with their grade, squad and ratings so the
   * panel can compute position fit without a round trip per candidate. The
   * MOVES are internalMutations behind the same per-`teamId` gate.
   */
  | "listRosterBoard"
  /*
   * B6. One team's own training ledger, keyed by the `teamId` the caller
   * already had to resolve to reach the page. Nothing hidden passes through it
   * — an allocation is a coach's stated plan, not a rating anyone can't see —
   * and both writes (`allocateTraining`, `applyTrainingAllocations`) are
   * internalMutations.
   */
  | "listTrainingAllocations";
type AllowedPublicSimReads =
  | "moduleStatus"
  | "listRivalries"
  | "listActiveInjuries"
  | "listTeamInjuries";
type AllowedPublicProgramReads =
  | "moduleStatus"
  | "listTeamPrograms"
  | "getTeamProgram"
  | "listFixtureGameplans"
  | "listGameplansBySeason"
  | "getCoach"
  | "listCoachesByTeam"
  | "listCoachesByLeague"
  | "listCoachSeasons"
  | "getSeasonGoalProgress";
type AllowedPublicHistoryReads = "moduleStatus";

type LeakedPublicDynastyWrites = Exclude<
  keyof typeof api.dynasty,
  AllowedPublicDynastyReads
>;
type LeakedPublicSimWrites = Exclude<
  keyof typeof api.sim,
  AllowedPublicSimReads
>;
type LeakedPublicProgramWrites = Exclude<
  keyof typeof api.program,
  AllowedPublicProgramReads
>;
type LeakedPublicHistoryWrites = Exclude<
  keyof typeof api.history,
  AllowedPublicHistoryReads
>;

const _noLeakedPublicDynastyWrites: LeakedPublicDynastyWrites extends never
  ? true
  : LeakedPublicDynastyWrites = true;
const _noLeakedPublicSimWrites: LeakedPublicSimWrites extends never
  ? true
  : LeakedPublicSimWrites = true;
const _noLeakedPublicProgramWrites: LeakedPublicProgramWrites extends never
  ? true
  : LeakedPublicProgramWrites = true;
const _noLeakedPublicHistoryWrites: LeakedPublicHistoryWrites extends never
  ? true
  : LeakedPublicHistoryWrites = true;
void _noLeakedPublicDynastyWrites;
void _noLeakedPublicSimWrites;
void _noLeakedPublicProgramWrites;
void _noLeakedPublicHistoryWrites;

// --- e2e seed mutations MUST be internal too (WSM-000139) ---
// Same vuln class as the sports.ts writes above: they create/destroy real
// rows, so they must never be reachable by an anonymous client. The env gate
// (CONVEX_ENABLE_E2E_SEED) is defense-in-depth, not the boundary.
void internal.e2eSeed.createRosterFixture;
void internal.e2eSeed.resetRosterFixture;
void internal.e2eSeed.createScheduleFixture;
// @ts-expect-error createRosterFixture is internal, not public
void api.e2eSeed.createRosterFixture;
// @ts-expect-error resetRosterFixture is internal, not public
void api.e2eSeed.resetRosterFixture;
// @ts-expect-error createScheduleFixture is internal, not public
void api.e2eSeed.createScheduleFixture;

// --- Data migrations MUST be internal too (WSM-000079) ---
// Backfills/migrations write rows; they're run manually with an admin/deploy
// key (`npx convex run migrations/... --prod`), never from the public API.
void internal.migrations["20260422_seasonsRosterLocked"]
  .backfillSeasonsRosterLocked;
void internal.migrations["20260428_playersPositionGroup"]
  .backfillPlayersPositionGroup;
void internal.migrations["20260428_depthChartToRoster"].migrateDepthChartToRoster;
void internal.migrations["20260801_seasonTeamRecords"]
  .backfillSeasonTeamRecords;
void internal.migrations["20260801_playerSeasonAggregates"]
  .backfillPlayerSeasonAggregates;
// @ts-expect-error backfillSeasonsRosterLocked is internal, not public
void api.migrations["20260422_seasonsRosterLocked"].backfillSeasonsRosterLocked;
// @ts-expect-error backfillPlayersPositionGroup is internal, not public
void api.migrations["20260428_playersPositionGroup"].backfillPlayersPositionGroup;
// @ts-expect-error migrateDepthChartToRoster is internal, not public
void api.migrations["20260428_depthChartToRoster"].migrateDepthChartToRoster;

describe("sports write mutations are internal (WSM-000096)", () => {
  it("is enforced at compile time (see @ts-expect-error guards above)", () => {
    // Runtime assertion is trivial; the real guard is tsc. The proxy-based
    // `internal` object always returns a reference, so this just documents intent.
    expect(typeof internal.sports.createTeam).not.toBe("undefined");
  });
});

describe("e2e seed mutations are internal (WSM-000139)", () => {
  it("is enforced at compile time (see @ts-expect-error guards above)", () => {
    expect(typeof internal.e2eSeed.createRosterFixture).not.toBe("undefined");
  });
});

describe("dynasty module writes are internal (F1)", () => {
  it("is enforced at compile time (see the per-module Exclude backstops above)", () => {
    // The four Dynasty Mode modules must expose reads only. The real guard is
    // tsc; this documents intent and keeps the suite honest about coverage.
    expect(typeof api.dynasty.moduleStatus).not.toBe("undefined");
    expect(typeof api.sim.moduleStatus).not.toBe("undefined");
    expect(typeof api.program.moduleStatus).not.toBe("undefined");
    expect(typeof api.history.moduleStatus).not.toBe("undefined");
  });
});

describe("data migrations are internal (WSM-000079)", () => {
  it("is enforced at compile time (see @ts-expect-error guards above)", () => {
    expect(
      typeof internal.migrations["20260428_depthChartToRoster"]
        .migrateDepthChartToRoster,
    ).not.toBe("undefined");
  });
});

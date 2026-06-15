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
void internal.sports.setOrgMemberRole;
void internal.sports.updateDivision;
void internal.sports.deleteDivision;
void internal.sports.setLeaguePublic;
void internal.sports.recordGameResult;
void internal.sports.assignPlayerToRoster;
void internal.sports.forkTeamToWorkspace;
void internal.sports.forkDivisionToWorkspace;
void internal.sports.forkConferenceToWorkspace;
void internal.sports.unforkTeamFromWorkspace;

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
// @ts-expect-error setOrgMemberRole is internal, not public
void api.sports.setOrgMemberRole;
// @ts-expect-error forkDivisionToWorkspace is internal, not public
void api.sports.forkDivisionToWorkspace;
// @ts-expect-error forkConferenceToWorkspace is internal, not public
void api.sports.forkConferenceToWorkspace;
// @ts-expect-error unforkTeamFromWorkspace is internal, not public
void api.sports.unforkTeamFromWorkspace;

// --- Public READ queries must remain public (these must exist on api) ---
void api.sports.listTeams;
void api.sports.listConferences;
void api.sports.getPlayer;
void api.sports.listPublicLeagues;
void api.sports.computeStandingsPublic;
void api.sports.getPlayerDevelopmentPublic;

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

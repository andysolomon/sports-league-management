/// <reference types="vite/client" />
import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

const modules = import.meta.glob("../**/*.*s");

const ORG = "org_coach";

/**
 * Seed a forkable reference league (public + claimable) with a conference
 * containing two divisions, each with two teams (and one player apiece). Returns
 * the ids the fork tests need.
 */
async function seedReferenceLeague(t: ReturnType<typeof convexTest>) {
  return t.run(async (ctx) => {
    const leagueId = await ctx.db.insert("leagues", {
      name: "Reference League",
      orgId: null,
      isPublic: true,
      inviteToken: null,
      claimable: true,
    });
    const conferenceId = await ctx.db.insert("conferences", {
      name: "Conference A",
      leagueId,
    });
    const divisionIds: Id<"divisions">[] = [];
    const teamIds: Id<"teams">[] = [];
    for (let d = 0; d < 2; d++) {
      const divisionId = await ctx.db.insert("divisions", {
        name: `Division ${d}`,
        leagueId,
        conferenceId,
      });
      divisionIds.push(divisionId);
      for (let i = 0; i < 2; i++) {
        const teamId = await ctx.db.insert("teams", {
          name: `Team ${d}-${i}`,
          leagueId,
          divisionId,
          city: "City",
          stadium: "Stadium",
          foundedYear: null,
          location: "Loc",
          logoUrl: null,
          rosterLimit: 53,
        });
        teamIds.push(teamId);
        await ctx.db.insert("players", {
          name: `Player ${d}-${i}`,
          leagueId,
          teamId,
          position: "QB",
          positionGroup: null,
          jerseyNumber: 1,
          dateOfBirth: null,
          status: "active",
          headshotUrl: null,
        });
      }
    }
    return { leagueId, conferenceId, divisionIds, teamIds };
  });
}

async function workspaceTeamCount(
  t: ReturnType<typeof convexTest>,
  orgId: string,
): Promise<number> {
  return t.run(async (ctx: MutationCtx) => {
    const leagues = await ctx.db
      .query("leagues")
      .withIndex("by_orgId", (q) => q.eq("orgId", orgId))
      .collect();
    let count = 0;
    for (const l of leagues) {
      const teams = await ctx.db
        .query("teams")
        .withIndex("by_leagueId", (q) => q.eq("leagueId", l._id))
        .collect();
      count += teams.length;
    }
    return count;
  });
}

describe("hierarchical Discover fork (WSM-000133)", () => {
  it("forks every team in a division in one action", async () => {
    const t = convexTest(schema, modules);
    const { divisionIds } = await seedReferenceLeague(t);

    const res = await t.mutation(internal.sports.forkDivisionToWorkspace, {
      orgId: ORG,
      divisionId: divisionIds[0],
    });

    expect(res.totalTeams).toBe(2);
    expect(res.forkedTeams).toBe(2);
    expect(res.alreadyForked).toBe(0);
    expect(await workspaceTeamCount(t, ORG)).toBe(2);
  });

  it("mirrors the conference + division hierarchy into the workspace", async () => {
    const t = convexTest(schema, modules);
    const { divisionIds } = await seedReferenceLeague(t);

    await t.mutation(internal.sports.forkDivisionToWorkspace, {
      orgId: ORG,
      divisionId: divisionIds[0],
    });

    await t.run(async (ctx) => {
      const league = (
        await ctx.db
          .query("leagues")
          .withIndex("by_orgId", (q) => q.eq("orgId", ORG))
          .collect()
      )[0];
      const conferences = await ctx.db
        .query("conferences")
        .withIndex("by_leagueId", (q) => q.eq("leagueId", league._id))
        .collect();
      expect(conferences).toHaveLength(1);
      expect(conferences[0].name).toBe("Conference A");
      expect(conferences[0].sourceConferenceId).toBeTruthy();

      const divisions = await ctx.db
        .query("divisions")
        .withIndex("by_leagueId", (q) => q.eq("leagueId", league._id))
        .collect();
      expect(divisions).toHaveLength(1);
      expect(divisions[0].conferenceId).toBe(conferences[0]._id);
    });
  });

  it("is idempotent — re-running a division fork adds nothing new", async () => {
    const t = convexTest(schema, modules);
    const { divisionIds } = await seedReferenceLeague(t);

    await t.mutation(internal.sports.forkDivisionToWorkspace, {
      orgId: ORG,
      divisionId: divisionIds[0],
    });
    const second = await t.mutation(internal.sports.forkDivisionToWorkspace, {
      orgId: ORG,
      divisionId: divisionIds[0],
    });

    expect(second.forkedTeams).toBe(0);
    expect(second.alreadyForked).toBe(2);
    expect(await workspaceTeamCount(t, ORG)).toBe(2);
  });

  it("partial: a division fork adds only the teams not already forked", async () => {
    const t = convexTest(schema, modules);
    const { divisionIds, teamIds } = await seedReferenceLeague(t);

    // Pre-fork ONE team in division 0 individually.
    await t.mutation(internal.sports.forkTeamToWorkspace, {
      orgId: ORG,
      sourceTeamId: teamIds[0],
    });
    expect(await workspaceTeamCount(t, ORG)).toBe(1);

    const res = await t.mutation(internal.sports.forkDivisionToWorkspace, {
      orgId: ORG,
      divisionId: divisionIds[0],
    });

    expect(res.totalTeams).toBe(2);
    expect(res.forkedTeams).toBe(1); // only the remaining team
    expect(res.alreadyForked).toBe(1);
    expect(await workspaceTeamCount(t, ORG)).toBe(2);
  });

  it("conference fork cascades over all divisions/teams under it", async () => {
    const t = convexTest(schema, modules);
    const { conferenceId } = await seedReferenceLeague(t);

    const res = await t.mutation(internal.sports.forkConferenceToWorkspace, {
      orgId: ORG,
      conferenceId,
    });

    expect(res.totalTeams).toBe(4);
    expect(res.forkedTeams).toBe(4);
    expect(res.alreadyForked).toBe(0);
    expect(await workspaceTeamCount(t, ORG)).toBe(4);
  });

  it("conference fork is idempotent and reports partials", async () => {
    const t = convexTest(schema, modules);
    const { conferenceId, divisionIds } = await seedReferenceLeague(t);

    // Add one division first, then the whole conference.
    await t.mutation(internal.sports.forkDivisionToWorkspace, {
      orgId: ORG,
      divisionId: divisionIds[0],
    });
    const res = await t.mutation(internal.sports.forkConferenceToWorkspace, {
      orgId: ORG,
      conferenceId,
    });

    expect(res.totalTeams).toBe(4);
    expect(res.forkedTeams).toBe(2); // the other division's teams
    expect(res.alreadyForked).toBe(2);
    expect(await workspaceTeamCount(t, ORG)).toBe(4);
  });

  it("refuses to fork a non-forkable (private) league's division", async () => {
    const t = convexTest(schema, modules);
    const divisionId = await t.run(async (ctx) => {
      const leagueId = await ctx.db.insert("leagues", {
        name: "Private",
        orgId: "org_other",
        isPublic: false,
        inviteToken: null,
      });
      const divisionId = await ctx.db.insert("divisions", {
        name: "Div",
        leagueId,
      });
      await ctx.db.insert("teams", {
        name: "T",
        leagueId,
        divisionId,
        city: "C",
        stadium: "S",
        foundedYear: null,
        location: "L",
        logoUrl: null,
        rosterLimit: null,
      });
      return divisionId;
    });

    await expect(
      t.mutation(internal.sports.forkDivisionToWorkspace, {
        orgId: ORG,
        divisionId,
      }),
    ).rejects.toThrow(/not forkable/);
  });
});

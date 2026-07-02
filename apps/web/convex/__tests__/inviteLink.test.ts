/// <reference types="vite/client" />
import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { api } from "../_generated/api";

const modules = import.meta.glob("../**/*.*s");

// WSM-000199 regression: the old getLeagueForOrg used .unique() on by_orgId
// and threw for any org owning 2+ leagues (workspace forks, claimed teams).
// getLeagueInviteInfo is keyed by league, so multi-league orgs must work and
// each league must resolve its own token.
describe("getLeagueInviteInfo", () => {
  it("resolves each league's own token when one org owns multiple leagues", async () => {
    const t = convexTest(schema, modules);

    const { leagueA, leagueB } = await t.run(async (ctx) => {
      const leagueA = await ctx.db.insert("leagues", {
        name: "Primary League",
        orgId: "org_multi",
        isPublic: true,
        inviteToken: "token-a",
      });
      const leagueB = await ctx.db.insert("leagues", {
        name: "Workspace Fork",
        orgId: "org_multi",
        isPublic: false,
        inviteToken: null,
      });
      return { leagueA, leagueB };
    });

    const infoA = await t.query(api.sports.getLeagueInviteInfo, {
      leagueId: leagueA,
    });
    const infoB = await t.query(api.sports.getLeagueInviteInfo, {
      leagueId: leagueB,
    });

    expect(infoA).toEqual({ orgId: "org_multi", token: "token-a" });
    expect(infoB).toEqual({ orgId: "org_multi", token: null });
  });

  it("returns null orgId for an org-less league and null for a deleted league", async () => {
    const t = convexTest(schema, modules);

    const leagueId = await t.run(async (ctx) =>
      ctx.db.insert("leagues", {
        name: "Public League",
        orgId: null,
        isPublic: true,
        inviteToken: null,
      }),
    );

    expect(
      await t.query(api.sports.getLeagueInviteInfo, { leagueId }),
    ).toEqual({ orgId: null, token: null });

    await t.run(async (ctx) => ctx.db.delete(leagueId));

    expect(
      await t.query(api.sports.getLeagueInviteInfo, { leagueId }),
    ).toBeNull();
  });
});

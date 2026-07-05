/// <reference types="vite/client" />
import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

const modules = import.meta.glob("../**/*.*s");

describe("currentSeasonId fallback (dynasty D1)", () => {
  it("prefers the active season when present", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, activeId, olderId } = await t.run(async (ctx) => {
      const leagueId = await ctx.db.insert("leagues", {
        name: "Dynasty",
        orgId: "org_1",
        isPublic: false,
        inviteToken: null,
      });
      const olderId = await ctx.db.insert("seasons", {
        name: "2024",
        leagueId,
        startDate: "2024-09-01",
        endDate: null,
        status: "completed",
        rosterLocked: false,
      });
      const activeId = await ctx.db.insert("seasons", {
        name: "2025",
        leagueId,
        startDate: "2025-09-01",
        endDate: null,
        status: "active",
        rosterLocked: false,
      });
      return { leagueId, activeId, olderId };
    });

    const teamId = await t.run(async (ctx) =>
      ctx.db.insert("teams", {
        name: "T",
        leagueId,
        divisionId: null,
        city: "C",
        stadium: "S",
        foundedYear: null,
        location: "L",
        logoUrl: null,
        rosterLimit: 53,
      }),
    );
    const playerId = await t.run(async (ctx) =>
      ctx.db.insert("players", {
        name: "QB",
        leagueId,
        teamId,
        position: "QB",
        positionGroup: null,
        jerseyNumber: 1,
        dateOfBirth: null,
        status: "Active",
        headshotUrl: null,
      }),
    );
    await t.run(async (ctx) => {
      await ctx.db.insert("playerAttributes", {
        playerId,
        seasonId: activeId,
        positionGroup: "QB",
        attributesJson: JSON.stringify({ SPD: 80 }),
        pffSourceJson: null,
        maddenSourceJson: null,
        pffWeight: 0,
        maddenWeight: 1,
        weightedOverall: 80,
        ingestedAt: new Date().toISOString(),
      });
      await ctx.db.insert("playerAttributes", {
        playerId,
        seasonId: olderId,
        positionGroup: "QB",
        attributesJson: JSON.stringify({ SPD: 50 }),
        pffSourceJson: null,
        maddenSourceJson: null,
        pffWeight: 0,
        maddenWeight: 1,
        weightedOverall: 50,
        ingestedAt: new Date().toISOString(),
      });
    });

    const attrs = await t.query(api.sports.getPlayerSeasonAttributes, {
      playerId,
    });
    expect(attrs?.weightedOverall).toBe(80);
  });

  it("falls back to the most recently created season when none is active", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, newestId } = await t.run(async (ctx) => {
      const leagueId = await ctx.db.insert("leagues", {
        name: "Dynasty",
        orgId: "org_1",
        isPublic: false,
        inviteToken: null,
      });
      await ctx.db.insert("seasons", {
        name: "2024",
        leagueId,
        startDate: "2024-09-01",
        endDate: null,
        status: "completed",
        rosterLocked: false,
      });
      const newestId = await ctx.db.insert("seasons", {
        name: "2026",
        leagueId,
        startDate: "2026-09-01",
        endDate: null,
        status: "completed",
        rosterLocked: false,
      });
      return { leagueId, newestId };
    });

    const teamId = await t.run(async (ctx) =>
      ctx.db.insert("teams", {
        name: "T",
        leagueId,
        divisionId: null,
        city: "C",
        stadium: "S",
        foundedYear: null,
        location: "L",
        logoUrl: null,
        rosterLimit: 53,
      }),
    );
    const playerId = await t.run(async (ctx) =>
      ctx.db.insert("players", {
        name: "QB",
        leagueId,
        teamId,
        position: "QB",
        positionGroup: null,
        jerseyNumber: 1,
        dateOfBirth: null,
        status: "Active",
        headshotUrl: null,
      }),
    );
    await t.run(async (ctx) => {
      await ctx.db.insert("playerAttributes", {
        playerId,
        seasonId: newestId,
        positionGroup: "QB",
        attributesJson: JSON.stringify({ SPD: 77 }),
        pffSourceJson: null,
        maddenSourceJson: null,
        pffWeight: 0,
        maddenWeight: 1,
        weightedOverall: 77,
        ingestedAt: new Date().toISOString(),
      });
    });

    const attrs = await t.query(api.sports.getPlayerSeasonAttributes, {
      playerId,
    });
    expect(attrs?.weightedOverall).toBe(77);
  });
});

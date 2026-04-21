/// <reference types="vite/client" />
import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { writeAuditLog } from "../lib/auditLog";

const modules = import.meta.glob("../**/*.*s");

async function seed(t: ReturnType<typeof convexTest>) {
  return t.run(async (ctx) => {
    const leagueId = await ctx.db.insert("leagues", {
      name: "Audit League",
      orgId: null,
      isPublic: true,
      inviteToken: null,
    });
    const teamId = await ctx.db.insert("teams", {
      name: "Audit Team",
      leagueId,
      divisionId: null,
      city: "City",
      stadium: "Stadium",
      foundedYear: null,
      location: "City",
      logoUrl: null,
      rosterLimit: 53,
    });
    const seasonId = await ctx.db.insert("seasons", {
      name: "2026",
      leagueId,
      startDate: null,
      endDate: null,
      status: "active",
      rosterLocked: false,
    });
    return { leagueId, teamId, seasonId };
  });
}

describe("writeAuditLog", () => {
  it("inserts an audit row with stringified before/after JSON", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, teamId, seasonId } = await seed(t);

    const insertedId = await t.run(async (ctx) => {
      return writeAuditLog(ctx, {
        leagueId,
        teamId,
        seasonId,
        actorUserId: "user_123",
        action: "assign",
        before: null,
        after: { playerId: "p1", depthRank: 1 },
      });
    });

    const row = await t.run(async (ctx) => ctx.db.get(insertedId));
    expect(row).toMatchObject({
      leagueId,
      teamId,
      seasonId,
      actorUserId: "user_123",
      action: "assign",
      beforeJson: null,
      afterJson: JSON.stringify({ playerId: "p1", depthRank: 1 }),
    });
    expect(row?.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("round-trips both before and after", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, teamId, seasonId } = await seed(t);

    const before = { status: "active", depthRank: 2 };
    const after = { status: "ir", depthRank: null };

    const id = await t.run(async (ctx) =>
      writeAuditLog(ctx, {
        leagueId,
        teamId,
        seasonId,
        actorUserId: "user_xyz",
        action: "status_change",
        before,
        after,
      }),
    );

    const row = await t.run(async (ctx) => ctx.db.get(id));
    expect(row?.beforeJson).toBe(JSON.stringify(before));
    expect(row?.afterJson).toBe(JSON.stringify(after));
  });

  it("throws when leagueId does not resolve", async () => {
    const t = convexTest(schema, modules);
    const { teamId, seasonId } = await seed(t);

    // Create a fake league id by inserting then deleting.
    const orphanLeagueId = await t.run(async (ctx) => {
      const id = await ctx.db.insert("leagues", {
        name: "Doomed",
        orgId: null,
        isPublic: false,
        inviteToken: null,
      });
      await ctx.db.delete(id);
      return id;
    });

    await expect(
      t.run((ctx) =>
        writeAuditLog(ctx, {
          leagueId: orphanLeagueId,
          teamId,
          seasonId,
          actorUserId: "u",
          action: "assign",
          before: null,
          after: { x: 1 },
        }),
      ),
    ).rejects.toThrow(/audit_log_invalid_leagueId/);
  });
});

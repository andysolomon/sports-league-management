import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { writeAuditLog } from "../lib/auditLog";

export const migrateDepthChartToRoster = mutation({
  args: { actorUserId: v.string() },
  returns: v.object({
    scanned: v.number(),
    copied: v.number(),
    skipped: v.number(),
  }),
  handler: async (ctx, args) => {
    const entries = await ctx.db.query("depthChartEntries").collect();
    let copied = 0;
    let skipped = 0;

    for (const entry of entries) {
      const existing = await ctx.db
        .query("rosterAssignments")
        .withIndex("by_seasonId_teamId_position", (q) =>
          q
            .eq("seasonId", entry.seasonId)
            .eq("teamId", entry.teamId)
            .eq("positionSlot", entry.positionSlot),
        )
        .filter((q) => q.eq(q.field("playerId"), entry.playerId))
        .first();

      if (existing) {
        skipped += 1;
        continue;
      }

      const team = await ctx.db.get(entry.teamId);
      if (!team) {
        skipped += 1;
        continue;
      }

      const depthRank = entry.sortOrder + 1;
      const now = new Date().toISOString();

      const insertedId = await ctx.db.insert("rosterAssignments", {
        seasonId: entry.seasonId,
        teamId: entry.teamId,
        playerId: entry.playerId,
        leagueId: team.leagueId,
        positionSlot: entry.positionSlot,
        depthRank,
        status: "active",
        assignedAt: now,
        assignedBy: args.actorUserId,
      });

      const inserted = await ctx.db.get(insertedId);
      if (!inserted) {
        throw new Error("migration_insert_failed");
      }

      await writeAuditLog(ctx, {
        leagueId: team.leagueId,
        teamId: entry.teamId,
        seasonId: entry.seasonId,
        actorUserId: args.actorUserId,
        action: "assign",
        before: null,
        after: {
          id: insertedId,
          seasonId: inserted.seasonId,
          teamId: inserted.teamId,
          playerId: inserted.playerId,
          leagueId: inserted.leagueId,
          depthRank: inserted.depthRank,
          positionSlot: inserted.positionSlot,
          status: inserted.status,
          assignedAt: inserted.assignedAt,
          assignedBy: inserted.assignedBy,
        },
      });

      copied += 1;
    }

    return { scanned: entries.length, copied, skipped };
  },
});

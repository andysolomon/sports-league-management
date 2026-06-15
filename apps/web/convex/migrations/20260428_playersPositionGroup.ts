import { internalMutationGeneric } from "convex/server";
import { v } from "convex/values";
import { derivePositionGroup } from "../../src/lib/position-group";

// Internal-only: migrations write data and must not be anonymously callable
// over the public Internet (WSM-000079 follow-up; see WSM-000096). Run with an
// admin/deploy key: `npx convex run migrations/... --prod`.
export const backfillPlayersPositionGroup = internalMutationGeneric({
  args: {},
  returns: v.object({
    scanned: v.number(),
    patched: v.number(),
    unresolved: v.number(),
  }),
  handler: async (ctx) => {
    const rows = await ctx.db.query("players").collect();
    let patched = 0;
    let unresolved = 0;
    for (const row of rows) {
      const existing = (row as { positionGroup?: string | null })
        .positionGroup;
      if (existing) continue;
      const group = derivePositionGroup(row.position);
      if (group === null) {
        unresolved += 1;
        continue;
      }
      await ctx.db.patch(row._id, { positionGroup: group });
      patched += 1;
    }
    return { scanned: rows.length, patched, unresolved };
  },
});

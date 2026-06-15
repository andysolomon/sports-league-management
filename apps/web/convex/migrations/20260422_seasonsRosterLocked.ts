import { internalMutationGeneric } from "convex/server";
import { v } from "convex/values";

// Internal-only: migrations write data and must not be anonymously callable
// over the public Internet (WSM-000079 follow-up; see WSM-000096). Run with an
// admin/deploy key: `npx convex run migrations/... --prod`.
export const backfillSeasonsRosterLocked = internalMutationGeneric({
  args: {},
  returns: v.object({
    scanned: v.number(),
    patched: v.number(),
  }),
  handler: async (ctx) => {
    const rows = await ctx.db.query("seasons").collect();
    let patched = 0;
    for (const row of rows) {
      if ((row as { rosterLocked?: boolean }).rosterLocked === undefined) {
        await ctx.db.patch(row._id, { rosterLocked: false });
        patched += 1;
      }
    }
    return { scanned: rows.length, patched };
  },
});

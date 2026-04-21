import { mutationGeneric } from "convex/server";
import { v } from "convex/values";

export const backfillSeasonsRosterLocked = mutationGeneric({
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

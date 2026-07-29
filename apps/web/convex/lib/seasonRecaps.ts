import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { isNarrativeEventType } from "./narrative";
import {
  composeRecap,
  type RecapEvent,
  type StorylineBlock,
} from "./recap";

export interface FinalizeSeasonRecapResult {
  blocksWritten: number;
  updated: boolean;
}

/**
 * Compose and upsert one season recap from its persisted dynasty headlines.
 *
 * The event query is indexed and composition is pure. Re-running replaces the
 * same row; it cannot duplicate either recap blocks or dynasty events.
 */
export async function finalizeSeasonRecapForSeason(
  ctx: MutationCtx,
  seasonId: Id<"seasons">,
): Promise<FinalizeSeasonRecapResult> {
  const season = await ctx.db.get(seasonId);
  if (!season) throw new Error("season_not_found");

  const rows = await ctx.db
    .query("dynastyEvents")
    .withIndex("by_seasonId_week", (q) => q.eq("seasonId", seasonId))
    .collect();
  const events = rows.flatMap((row): RecapEvent[] => {
    if (!isNarrativeEventType(row.eventType)) return [];
    return [
      {
        id: row._id as string,
        eventType: row.eventType,
        headline: row.headline,
        week: row.week,
        createdAt: row.createdAt,
      },
    ];
  });
  const blocks: StorylineBlock[] = composeRecap({
    seasonName: season.name,
    events,
  });
  const storylineBlocksJson = JSON.stringify(blocks);
  const now = new Date().toISOString();
  const existing = await ctx.db
    .query("seasonRecaps")
    .withIndex("by_seasonId", (q) => q.eq("seasonId", seasonId))
    .unique();

  if (existing) {
    const updated = existing.storylineBlocksJson !== storylineBlocksJson;
    if (updated) {
      await ctx.db.patch(existing._id, {
        storylineBlocksJson,
        updatedAt: now,
      });
    }
    return { blocksWritten: blocks.length, updated };
  }

  await ctx.db.insert("seasonRecaps", {
    leagueId: season.leagueId,
    seasonId,
    storylineBlocksJson,
    generatedAt: now,
    updatedAt: now,
  });
  return { blocksWritten: blocks.length, updated: true };
}

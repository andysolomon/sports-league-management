import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import {
  categoryFor,
  defaultSeverity,
  renderHeadline,
  type EventSeverity,
  type NarrativeInput,
} from "./narrative";

/*
 * Dynasty event emission (F4).
 *
 * `emitDynastyEvent` is the ONLY way rows enter `dynastyEvents`. Funnelling
 * every producer through one choke point is what makes replay safe: dedupe,
 * headline rendering and field defaults all happen in exactly one place, so a
 * new producer in Epic A/B/C/D cannot forget any of them.
 *
 * ## Replay semantics — upsert, not insert, and not a pure no-op
 *
 * The slice contract said "no-op on a `dedupeKey` hit". This implements the
 * invariant that mattered — **one row per `dedupeKey`, always** — but as an
 * UPSERT rather than a no-op, because a strict no-op is wrong for the very case
 * dedupe exists to handle.
 *
 * Re-simulating a fixture under a new engine version produces a DIFFERENT
 * score. The happening ("this game finished") is the same, so it must not
 * appear twice — but a no-op would leave the feed asserting the old scoreline
 * forever, and Epic D's recap would then narrate a game that no longer matches
 * the box score. Upserting keeps the row identity and refreshes the copy.
 *
 * `createdAt` is preserved from the original insert, so refreshing content
 * never reorders the feed.
 */

export interface EmitEventArgs {
  leagueId: Id<"leagues">;
  seasonId?: Id<"seasons"> | null;
  week?: number | null;
  teamId?: Id<"teams"> | null;
  playerId?: Id<"players"> | null;
  fixtureId?: Id<"fixtures"> | null;
  /** Stable identity of the happening. MUST exclude engine version. */
  dedupeKey: string;
  /** Rendered through `lib/narrative.ts`; never pass pre-built copy. */
  narrative: NarrativeInput;
  /** Overrides the type's default. */
  severity?: EventSeverity;
  /** Structured payload for surfaces wanting more than the headline. */
  detail?: unknown;
}

export interface EmitEventResult {
  eventId: Id<"dynastyEvents">;
  created: boolean;
}

export async function emitDynastyEvent(
  ctx: MutationCtx,
  args: EmitEventArgs,
): Promise<EmitEventResult> {
  const now = new Date().toISOString();
  const headline = renderHeadline(args.narrative);
  const detailJson =
    args.detail === undefined ? null : JSON.stringify(args.detail);

  const content = {
    leagueId: args.leagueId,
    seasonId: args.seasonId ?? null,
    week: args.week ?? null,
    category: categoryFor(args.narrative.type),
    eventType: args.narrative.type,
    severity: args.severity ?? defaultSeverity(args.narrative.type),
    teamId: args.teamId ?? null,
    playerId: args.playerId ?? null,
    fixtureId: args.fixtureId ?? null,
    headline,
    detailJson,
    dedupeKey: args.dedupeKey,
  };

  const existing = await ctx.db
    .query("dynastyEvents")
    .withIndex("by_dedupeKey", (q) => q.eq("dedupeKey", args.dedupeKey))
    .first();

  if (existing) {
    // Preserve createdAt so refreshed copy never jumps position in the feed.
    await ctx.db.replace(existing._id, {
      ...content,
      createdAt: existing.createdAt,
      updatedAt: now,
    });
    return { eventId: existing._id, created: false };
  }

  const eventId = await ctx.db.insert("dynastyEvents", {
    ...content,
    createdAt: now,
    updatedAt: now,
  });
  return { eventId, created: true };
}

/** Remove a league's events. Used by season/league cascade deletes. */
export async function clearLeagueEvents(
  ctx: MutationCtx,
  leagueId: Id<"leagues">,
): Promise<void> {
  const rows = await ctx.db
    .query("dynastyEvents")
    .withIndex("by_leagueId_createdAt", (q) => q.eq("leagueId", leagueId))
    .collect();
  for (const row of rows) await ctx.db.delete(row._id);
}

/** Remove a season's events, leaving league-scoped ones intact. */
export async function clearSeasonEvents(
  ctx: MutationCtx,
  seasonId: Id<"seasons">,
): Promise<void> {
  const rows = await ctx.db
    .query("dynastyEvents")
    .withIndex("by_seasonId_week", (q) => q.eq("seasonId", seasonId))
    .collect();
  for (const row of rows) await ctx.db.delete(row._id);
}

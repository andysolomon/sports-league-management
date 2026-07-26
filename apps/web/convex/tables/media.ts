import { defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Live streaming and highlight clips (Mux / YouTube). Definitions moved verbatim
 * from `schema.ts` (Dynasty Mode F1).
 */
export const mediaTables = {
  /*
   * One live stream per fixture (WSM-000144, streaming epic #225). Two
   * providers (WSM-000180): "mux" (RTMP ingest, paid) keeps the server-side
   * live-stream id + public HLS playback id; "youtube" (free, paste-a-link)
   * keeps only the public YouTube video id. The Mux stream KEY is never stored.
   * Public reads project to status / playback ids / vodAssetId only; the Mux
   * live-stream id never transits a public query (see getStreamByFixture).
   */
  gameStreams: defineTable({
    fixtureId: v.id("fixtures"),
    provider: v.optional(v.string()), // "mux" | "youtube" (legacy rows = mux)
    muxLiveStreamId: v.optional(v.string()), // mux: server-side; never public
    muxPlaybackId: v.optional(v.string()), // mux: public HLS id
    youtubeVideoId: v.optional(v.union(v.string(), v.null())), // youtube: public
    status: v.string(), // "idle" | "active" | "ended"
    vodAssetId: v.union(v.string(), v.null()),
    // Public playback id of the RECORDED asset (WSM-000198, #303 track 1). The
    // live muxPlaybackId only serves the live edge — replays need the asset's
    // own playback id. Optional: legacy rows predate it.
    vodPlaybackId: v.optional(v.union(v.string(), v.null())),
    // "low" | "standard" (mux only; legacy/unset = standard). Records the
    // LL-HLS opt-in per stream (WSM-000200) so the cost/quality tradeoff can
    // be evaluated per pilot. Not exposed publicly.
    latencyMode: v.optional(v.string()),
    startedBy: v.string(),
    startedAt: v.string(),
    endedAt: v.union(v.string(), v.null()),
    maxDurationMinutes: v.number(),
  })
    .index("by_fixtureId", ["fixtureId"])
    .index("by_status", ["status"])
    // Mux webhooks identify the stream by its Mux live-stream id, not fixtureId.
    .index("by_muxLiveStreamId", ["muxLiveStreamId"]),

  /*
   * Shareable highlight clips cut from a game's stream recording (WSM-000201,
   * #303 track 3). Each clip is its OWN Mux asset (created from the VOD asset
   * via a `mux://assets/{id}` input) with its own public playback id. Writes
   * are internalMutation only; the public read lists READY clips projected to
   * playback-only fields — the clip's Mux asset id never transits a public
   * query.
   */
  gameClips: defineTable({
    fixtureId: v.id("fixtures"),
    muxAssetId: v.string(), // the clip's own asset id — server-side only
    playbackId: v.union(v.string(), v.null()), // public playback id
    label: v.string(),
    // Clip range in seconds within the source recording (admin display).
    startTime: v.number(),
    endTime: v.number(),
    // "preparing" | "ready" | "errored" — flipped by the Mux asset webhooks.
    status: v.string(),
    createdBy: v.string(),
    createdAt: v.string(),
  })
    .index("by_fixtureId", ["fixtureId"])
    // Mux asset webhooks identify a clip by its own asset id.
    .index("by_muxAssetId", ["muxAssetId"]),
};

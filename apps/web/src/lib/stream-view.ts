import type { PublicGameStream } from "@/lib/data-api";

/*
 * Replay-vs-live rendering decision for the public game page (WSM-000198,
 * #303 track 1). PURE — no IO — so it's unit-testable like mapMuxEventToUpdate.
 *
 * Provider semantics:
 *   mux     — while live, play the live playback id (muxPlaybackId). Once ended,
 *             the live id no longer serves the recording; the replay must play
 *             the recorded ASSET's own public playback id (vodPlaybackId),
 *             attached by the video.asset.* webhooks.
 *   youtube — the same public video id serves both the broadcast and its
 *             recording, so an ended stream with a video id is a replay.
 */

export type StreamViewMode = "live" | "replay" | "ended-no-replay" | "none";

export interface StreamView {
  mode: StreamViewMode;
  /** Mux playback id to hand the player: live id while live, VOD id for replay. */
  muxPlaybackId: string | null;
  youtubeVideoId: string | null;
}

export function resolveStreamView(stream: PublicGameStream | null): StreamView {
  if (!stream) return { mode: "none", muxPlaybackId: null, youtubeVideoId: null };

  if (stream.status === "active") {
    return {
      mode: "live",
      muxPlaybackId: stream.muxPlaybackId,
      youtubeVideoId: stream.youtubeVideoId,
    };
  }

  if (stream.status === "ended") {
    if (stream.provider === "youtube" && stream.youtubeVideoId !== null) {
      return {
        mode: "replay",
        muxPlaybackId: null,
        youtubeVideoId: stream.youtubeVideoId,
      };
    }
    if (stream.provider === "mux" && stream.vodPlaybackId !== null) {
      return {
        mode: "replay",
        muxPlaybackId: stream.vodPlaybackId,
        youtubeVideoId: null,
      };
    }
    // Ended with no playable recording (e.g. legacy Mux rows that predate
    // vodPlaybackId, or the asset webhooks haven't landed yet).
    return { mode: "ended-no-replay", muxPlaybackId: null, youtubeVideoId: null };
  }

  // "idle" (created, not yet live) — nothing to show the public.
  return { mode: "none", muxPlaybackId: null, youtubeVideoId: null };
}

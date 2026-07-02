import { updateGameStreamStatus } from "@/lib/data-api";

/*
 * Mux webhook event handling (WSM-000144). The event→action mapping is a PURE
 * function (mapMuxEventToUpdate) so it can be unit-tested without Mux or Convex;
 * handleMuxEvent applies the side effect via the admin-keyed data-api.
 *
 * Event semantics (Mux live streams):
 *   video.live_stream.active        → playable; status "active"
 *   video.live_stream.idle          → returned to idle AFTER the reconnect
 *                                      window; this is the authoritative END.
 *   video.live_stream.disconnected  → RTMP dropped, but Mux may still reconnect
 *                                      within the window — TRANSIENT, so we do
 *                                      NOT end on it (idle is authoritative).
 *                                      Ending here would kill a stream on a
 *                                      brief network blip.
 *   video.asset.ready               → the recording's VOD asset is playable
 *                                      (fires EARLY, ~10s in); attach vodAssetId
 *                                      + the asset's public playback id (keyed
 *                                      by live_stream_id).
 *   video.asset.live_stream_completed → the recording is FINALIZED (fires when
 *                                      the live stream goes idle). Same attach —
 *                                      belt-and-braces in case asset.ready was
 *                                      missed (WSM-000198, #303 track 1).
 * Everything else is a no-op.
 *
 * Replay needs the ASSET's own playback id: the live stream's playback id only
 * serves the live edge, not the recording (Mux "Stream recordings of live
 * streams" guide). Asset events carry the full Asset object, including
 * `playback_ids` and `live_stream_id` (Mux webhook reference).
 */

// Minimal shape we depend on — avoids coupling tests to the full Mux SDK type.
export interface MuxWebhookEvent {
  type: string;
  data: {
    id?: string;
    live_stream_id?: string | null;
    playback_ids?: { id?: string; policy?: string }[];
  };
}

export interface StreamStatusUpdate {
  muxLiveStreamId: string;
  status?: "active" | "ended";
  vodAssetId?: string;
  vodPlaybackId?: string;
  endedAt?: string;
}

/**
 * Pure mapping from a Mux event to a stream-status update, or null for events
 * we ignore. `nowIso` is injected (not read from the clock) to keep this pure
 * and deterministically testable.
 */
export function mapMuxEventToUpdate(
  event: MuxWebhookEvent,
  nowIso: string,
): StreamStatusUpdate | null {
  switch (event.type) {
    case "video.live_stream.active": {
      const id = event.data.id;
      return id ? { muxLiveStreamId: id, status: "active" } : null;
    }
    case "video.live_stream.idle": {
      const id = event.data.id;
      return id ? { muxLiveStreamId: id, status: "ended", endedAt: nowIso } : null;
    }
    case "video.asset.ready":
    case "video.asset.live_stream_completed": {
      // Only assets created FROM a live stream carry live_stream_id; uploads
      // (no live_stream_id) aren't ours — ignore them.
      const liveStreamId = event.data.live_stream_id;
      const assetId = event.data.id;
      if (!liveStreamId || !assetId) return null;
      // The asset's PUBLIC playback id is what the replay player uses. Phase 1
      // creates streams with new_asset_settings.playback_policy ["public"], so
      // one should always exist; tolerate its absence (attach the asset id only).
      const vodPlaybackId = event.data.playback_ids?.find(
        (p) => p.policy === "public" && p.id,
      )?.id;
      return {
        muxLiveStreamId: liveStreamId,
        vodAssetId: assetId,
        ...(vodPlaybackId ? { vodPlaybackId } : {}),
      };
    }
    default:
      return null;
  }
}

/** Apply a verified Mux event. No-op for ignored events and unknown streams. */
export async function handleMuxEvent(event: MuxWebhookEvent): Promise<void> {
  const update = mapMuxEventToUpdate(event, new Date().toISOString());
  if (!update) return;
  await updateGameStreamStatus(update);
}

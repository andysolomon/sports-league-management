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
 *   video.asset.ready               → the recording's VOD asset is ready; attach
 *                                      vodAssetId (keyed by live_stream_id).
 * Everything else is a no-op.
 */

// Minimal shape we depend on — avoids coupling tests to the full Mux SDK type.
export interface MuxWebhookEvent {
  type: string;
  data: {
    id?: string;
    live_stream_id?: string | null;
  };
}

export interface StreamStatusUpdate {
  muxLiveStreamId: string;
  status?: "active" | "ended";
  vodAssetId?: string;
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
    case "video.asset.ready": {
      // Only assets created FROM a live stream carry live_stream_id; uploads
      // (no live_stream_id) aren't ours — ignore them.
      const liveStreamId = event.data.live_stream_id;
      const assetId = event.data.id;
      if (!liveStreamId || !assetId) return null;
      return { muxLiveStreamId: liveStreamId, vodAssetId: assetId };
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

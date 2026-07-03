import { updateGameStreamStatus, updateGameClipStatus } from "@/lib/data-api";

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
    // Present ONLY on assets created FROM another asset — i.e. clips
    // (WSM-000201). The stream's own recording never carries it.
    source_asset_id?: string | null;
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
      // A CLIP asset (WSM-000201) carries source_asset_id. Whether or not Mux
      // also stamps live_stream_id on it, it must NEVER attach itself as the
      // stream's VOD recording — that would clobber the real replay ids. Clip
      // readiness is handled separately (mapMuxEventToClipUpdate).
      if (event.data.source_asset_id) return null;
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

export interface ClipStatusUpdate {
  muxAssetId: string;
  status: "ready" | "errored";
  playbackId?: string;
}

/**
 * Pure mapping from a Mux event to a CLIP status update (WSM-000201), or null
 * for non-clip events. Clips are the only assets we create with a
 * `mux://assets/…` input, so `source_asset_id` is the discriminator; the row
 * is keyed by the clip's own asset id.
 */
export function mapMuxEventToClipUpdate(
  event: MuxWebhookEvent,
): ClipStatusUpdate | null {
  const assetId = event.data.id;
  if (!event.data.source_asset_id || !assetId) return null;
  switch (event.type) {
    case "video.asset.ready": {
      // Belt-and-braces: the playback id is stored at creation, but re-attach
      // it from the event in case creation raced or the row predates it.
      const playbackId = event.data.playback_ids?.find(
        (p) => p.policy === "public" && p.id,
      )?.id;
      return {
        muxAssetId: assetId,
        status: "ready",
        ...(playbackId ? { playbackId } : {}),
      };
    }
    case "video.asset.errored":
      return { muxAssetId: assetId, status: "errored" };
    default:
      return null;
  }
}

/** Apply a verified Mux event. No-op for ignored events and unknown streams. */
export async function handleMuxEvent(event: MuxWebhookEvent): Promise<void> {
  const update = mapMuxEventToUpdate(event, new Date().toISOString());
  if (update) await updateGameStreamStatus(update);
  const clipUpdate = mapMuxEventToClipUpdate(event);
  if (clipUpdate) await updateGameClipStatus(clipUpdate);
}

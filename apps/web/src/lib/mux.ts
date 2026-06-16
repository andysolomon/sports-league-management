import "server-only";
import Mux from "@mux/mux-node";

/*
 * Mux Video integration for Phase 1 live streaming (WSM-000144, epic #225).
 *
 * Server-only: the token id/secret and webhook secret are never exposed to the
 * client (none are NEXT_PUBLIC_*). The public HLS playback id is the only Mux
 * identifier that ever reaches a browser, and it comes from the DB, not here.
 *
 * Mux ingest is a single global RTMP endpoint; only the per-stream key is
 * secret. We return the key in-memory to the starting admin and never persist
 * it (Mux holds it).
 */

// Mux's global RTMP(S) ingest endpoint — same for every live stream; the
// per-stream key (not this URL) is the secret part.
export const MUX_RTMP_INGEST_URL = "rtmps://global-live.mux.com:443/app";

let client: Mux | null = null;

export function getMux(): Mux {
  if (client) return client;
  const tokenId = process.env.MUX_TOKEN_ID;
  const tokenSecret = process.env.MUX_TOKEN_SECRET;
  if (!tokenId || !tokenSecret) {
    throw new Error(
      "Missing Mux credentials. Set MUX_TOKEN_ID and MUX_TOKEN_SECRET.",
    );
  }
  client = new Mux({
    tokenId,
    tokenSecret,
    // Used by webhooks.unwrap() to verify inbound webhook signatures.
    webhookSecret: process.env.MUX_WEBHOOK_SECRET,
  });
  return client;
}

export interface CreatedMuxLiveStream {
  liveStreamId: string;
  streamKey: string;
  playbackId: string;
  rtmpUrl: string;
}

/**
 * Create a public live stream with a hard max-duration cap so a forgotten
 * stream can never bill indefinitely. Recordings become public VOD assets.
 */
export async function createMuxLiveStream(
  maxDurationMinutes: number,
): Promise<CreatedMuxLiveStream> {
  const mux = getMux();
  const liveStream = await mux.video.liveStreams.create({
    playback_policy: ["public"],
    new_asset_settings: { playback_policy: ["public"] },
    // Mux expects seconds; this is the guardrail auto-stop.
    max_continuous_duration: maxDurationMinutes * 60,
  });

  const playbackId = liveStream.playback_ids?.[0]?.id;
  if (!liveStream.id || !liveStream.stream_key || !playbackId) {
    throw new Error("mux_live_stream_incomplete");
  }

  return {
    liveStreamId: liveStream.id,
    streamKey: liveStream.stream_key,
    playbackId,
    rtmpUrl: MUX_RTMP_INGEST_URL,
  };
}

/** Disable a live stream (admin manual stop). Idempotent-ish: Mux 404s are
 *  swallowed so a double-stop doesn't surface an error to the coach. */
export async function disableMuxLiveStream(liveStreamId: string): Promise<void> {
  const mux = getMux();
  try {
    await mux.video.liveStreams.disable(liveStreamId);
  } catch (err) {
    const status = (err as { status?: number } | null)?.status;
    if (status === 404) return;
    throw err;
  }
}

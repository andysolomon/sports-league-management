"use server";

import { revalidatePath } from "next/cache";
import { lowLatencyStreamingV1 } from "@/lib/flags";
import {
  createGameStream,
  updateGameStreamStatus,
  endGameStreamByFixture,
  getActiveStreamCountForLeague,
  getStreamAdminByFixture,
} from "@/lib/data-api";
import { createMuxLiveStream, disableMuxLiveStream } from "@/lib/mux";
import { parseYoutubeVideoId } from "@/lib/youtube";
import { authorizeStreamAction } from "./stream-auth";

/*
 * Live-stream start/stop server actions (WSM-000144, dark behind
 * `live_streaming_v1`). Watch is public (the #300 game page); START/MANAGE is
 * authenticated and lives here in the dashboard, because the RTMP key must never
 * touch a public surface. The Mux stream key is returned in-memory to the
 * starting admin only — it is never persisted and never read back.
 *
 * Cost posture (decided 2026-06-16): absorbed + capped. No billing/entitlement
 * gate; guardrails bound the spend — a Mux max-duration auto-stop (set at
 * stream-create) plus the per-league concurrent cap below. The TODO marks the
 * clean seam where an entitlement check drops in for a later paid tier.
 */

const MAX_STREAM_DURATION_MINUTES = 180; // 3h hard cap → Mux max_continuous_duration
const PER_LEAGUE_CONCURRENT_CAP = 3; // bound blast radius for a pilot

type StartResult =
  | { ok: true; rtmpUrl: string; streamKey: string; playbackId: string }
  | { ok: false; error: string };

type StopResult = { ok: true } | { ok: false; error: string };

// Shared auth chain lives in ./stream-auth (plain server-only module, NOT a
// "use server" action) so the clip actions (WSM-000201) reuse it verbatim.

export async function startGameStream(
  leagueId: string,
  fixtureId: string,
): Promise<StartResult> {
  const guard = await authorizeStreamAction(leagueId, fixtureId);
  if (!guard.ok) return guard;
  if (guard.seasonStatus === "completed") {
    return { ok: false, error: "season_completed" };
  }
  // A finished/cancelled game can't go live.
  if (guard.fixtureStatus === "final" || guard.fixtureStatus === "cancelled") {
    return { ok: false, error: "game_over" };
  }

  // Concurrent-stream cap — bounds the absorbed cost for a pilot league.
  // TODO(streaming paid tier): replace/augment with an entitlement check here.
  const activeCount = await getActiveStreamCountForLeague(leagueId);
  if (activeCount >= PER_LEAGUE_CONCURRENT_CAP) {
    return { ok: false, error: "stream_cap_reached" };
  }

  try {
    // #303 track 2: LL-HLS is a per-env opt-in; off/unset = standard HLS.
    const lowLatency = await lowLatencyStreamingV1();
    const mux = await createMuxLiveStream(MAX_STREAM_DURATION_MINUTES, {
      lowLatency,
    });
    await createGameStream({
      fixtureId,
      muxLiveStreamId: mux.liveStreamId,
      muxPlaybackId: mux.playbackId,
      latencyMode: lowLatency ? "low" : "standard",
      startedBy: guard.userId,
      maxDurationMinutes: MAX_STREAM_DURATION_MINUTES,
    });

    revalidatePath(`/dashboard/leagues/${leagueId}/schedule`);
    revalidatePath(`/leagues/${leagueId}/games/${fixtureId}`);

    // Key returned to the starting admin ONLY — never persisted, never re-read.
    return {
      ok: true,
      rtmpUrl: mux.rtmpUrl,
      streamKey: mux.streamKey,
      playbackId: mux.playbackId,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

/**
 * Free streaming path (WSM-000180): a coach goes live on their own (unlisted)
 * YouTube broadcast and pastes the watch/live URL. We store only the public
 * video id and embed the player — YouTube handles ingest, delivery, and the
 * recording (the same link becomes the replay). No RTMP key transits our app.
 */
export async function startYoutubeStream(
  leagueId: string,
  fixtureId: string,
  youtubeUrl: string,
): Promise<StopResult> {
  const guard = await authorizeStreamAction(leagueId, fixtureId);
  if (!guard.ok) return guard;
  if (guard.seasonStatus === "completed") {
    return { ok: false, error: "season_completed" };
  }
  // A finished/cancelled game can't go live.
  if (guard.fixtureStatus === "final" || guard.fixtureStatus === "cancelled") {
    return { ok: false, error: "game_over" };
  }

  const videoId = parseYoutubeVideoId(youtubeUrl);
  if (!videoId) return { ok: false, error: "invalid_youtube_url" };

  // Same concurrent cap as Mux — bounds how many live games a league juggles.
  const activeCount = await getActiveStreamCountForLeague(leagueId);
  if (activeCount >= PER_LEAGUE_CONCURRENT_CAP) {
    return { ok: false, error: "stream_cap_reached" };
  }

  try {
    await createGameStream({
      fixtureId,
      provider: "youtube",
      youtubeVideoId: videoId,
      startedBy: guard.userId,
      maxDurationMinutes: MAX_STREAM_DURATION_MINUTES,
    });
    revalidatePath(`/dashboard/leagues/${leagueId}/schedule`);
    revalidatePath(`/leagues/${leagueId}/games/${fixtureId}`);
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

export async function stopGameStream(
  leagueId: string,
  fixtureId: string,
): Promise<StopResult> {
  const guard = await authorizeStreamAction(leagueId, fixtureId);
  if (!guard.ok) return guard;

  try {
    const stream = await getStreamAdminByFixture(fixtureId);
    if (!stream) return { ok: false, error: "stream_not_found" };

    if (stream.provider === "youtube") {
      // No Mux resource to tear down — the broadcast lives on YouTube. Just mark
      // it ended; the same video id then serves as the replay on the game page.
      await endGameStreamByFixture(fixtureId, new Date().toISOString());
    } else {
      if (stream.muxLiveStreamId) {
        await disableMuxLiveStream(stream.muxLiveStreamId);
        // Reflect the stop immediately; the webhook also flips this idempotently.
        await updateGameStreamStatus({
          muxLiveStreamId: stream.muxLiveStreamId,
          status: "ended",
          endedAt: new Date().toISOString(),
        });
      }
    }

    revalidatePath(`/dashboard/leagues/${leagueId}/schedule`);
    revalidatePath(`/leagues/${leagueId}/games/${fixtureId}`);
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

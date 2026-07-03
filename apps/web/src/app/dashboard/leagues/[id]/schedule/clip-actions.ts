"use server";

import { revalidatePath } from "next/cache";
import {
  getStreamByFixture,
  createGameClip as persistGameClip,
  deleteGameClip as removeGameClip,
  listClipsAdminByFixture,
} from "@/lib/data-api";
import { createMuxClip, deleteMuxAsset } from "@/lib/mux";
import { authorizeStreamAction } from "./stream-auth";

/*
 * Highlight-clip server actions (WSM-000201, #303 track 3; dark behind
 * `live_streaming_v1` like the rest of streaming). Creation/deletion is
 * authenticated + team-admin-gated via the same chain as go-live; the public
 * game page only ever sees READY clips through the playback-only projection.
 *
 * Cost posture mirrors streaming (absorbed + capped): bounded clip length, a
 * per-fixture clip cap, and `video_quality: "basic"` at the Mux layer.
 */

const MIN_CLIP_SECONDS = 1; // Mux's floor is 500ms; whole seconds keep the UI simple
const MAX_CLIP_SECONDS = 10 * 60; // a highlight, not a re-broadcast
const MAX_LABEL_LENGTH = 80;
const PER_FIXTURE_CLIP_CAP = 20; // bound per-game Mux asset spend

/** Admin clip shape safe to hand a client component — no Mux asset id. */
export interface ClientGameClip {
  id: string;
  playbackId: string | null;
  label: string;
  startTime: number;
  endTime: number;
  status: string; // "preparing" | "ready" | "errored"
  createdAt: string;
}

type ClipResult = { ok: true } | { ok: false; error: string };

export async function createClip(
  leagueId: string,
  fixtureId: string,
  input: { startSec: number; endSec: number; label: string },
): Promise<ClipResult> {
  const guard = await authorizeStreamAction(leagueId, fixtureId);
  if (!guard.ok) return guard;

  const label = input.label.trim();
  if (!label || label.length > MAX_LABEL_LENGTH) {
    return { ok: false, error: "invalid_label" };
  }
  const { startSec, endSec } = input;
  if (
    !Number.isFinite(startSec) ||
    !Number.isFinite(endSec) ||
    startSec < 0 ||
    endSec - startSec < MIN_CLIP_SECONDS ||
    endSec - startSec > MAX_CLIP_SECONDS
  ) {
    return { ok: false, error: "invalid_clip_range" };
  }

  // The clip source is the stream's recorded asset. YouTube recordings live on
  // YouTube — nothing to clip on our side.
  const stream = await getStreamByFixture(fixtureId);
  if (!stream || stream.provider !== "mux" || !stream.vodAssetId) {
    return { ok: false, error: "no_recording" };
  }

  const existing = await listClipsAdminByFixture(fixtureId);
  if (existing.length >= PER_FIXTURE_CLIP_CAP) {
    return { ok: false, error: "clip_cap_reached" };
  }

  try {
    const clip = await createMuxClip(stream.vodAssetId, startSec, endSec);
    await persistGameClip({
      fixtureId,
      muxAssetId: clip.assetId,
      playbackId: clip.playbackId,
      label,
      startTime: startSec,
      endTime: endSec,
      createdBy: guard.userId,
    });
    revalidatePath(`/dashboard/leagues/${leagueId}/schedule`);
    revalidatePath(`/leagues/${leagueId}/games/${fixtureId}`);
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

export async function deleteClip(
  leagueId: string,
  fixtureId: string,
  clipId: string,
): Promise<ClipResult> {
  const guard = await authorizeStreamAction(leagueId, fixtureId);
  if (!guard.ok) return guard;

  // Resolving the clip through the fixture's own list (not a get-by-id) pins
  // the delete to the fixture the caller was just authorized for.
  const clips = await listClipsAdminByFixture(fixtureId);
  const clip = clips.find((c) => c.id === clipId);
  if (!clip) return { ok: false, error: "clip_not_found" };

  try {
    // Tear down the Mux asset first; the row delete is the commit. Mux 404s
    // are swallowed in deleteMuxAsset, so a retry after a partial failure
    // converges instead of erroring.
    await deleteMuxAsset(clip.muxAssetId);
    await removeGameClip(clipId, fixtureId);
    revalidatePath(`/dashboard/leagues/${leagueId}/schedule`);
    revalidatePath(`/leagues/${leagueId}/games/${fixtureId}`);
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

/** Load the fixture's clips for the admin dialog. Strips the Mux asset id
 *  before anything reaches the client (server-side identifiers stay server-side,
 *  same posture as the stream key / live-stream id). */
export async function getClipsForAdmin(
  leagueId: string,
  fixtureId: string,
): Promise<
  { ok: true; clips: ClientGameClip[] } | { ok: false; error: string }
> {
  const guard = await authorizeStreamAction(leagueId, fixtureId);
  if (!guard.ok) return guard;

  const clips = await listClipsAdminByFixture(fixtureId);
  return {
    ok: true,
    clips: clips.map(({ muxAssetId: _muxAssetId, ...safe }) => safe),
  };
}

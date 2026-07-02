import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockUpdateGameStreamStatus } = vi.hoisted(() => ({
  mockUpdateGameStreamStatus: vi.fn(),
}));

vi.mock("@/lib/data-api", () => ({
  updateGameStreamStatus: mockUpdateGameStreamStatus,
}));

import {
  mapMuxEventToUpdate,
  handleMuxEvent,
} from "../mux-webhook-handlers";

const NOW = "2026-06-16T12:00:00.000Z";

describe("mapMuxEventToUpdate (pure)", () => {
  it("maps live_stream.active → status active", () => {
    expect(
      mapMuxEventToUpdate(
        { type: "video.live_stream.active", data: { id: "ls_1" } },
        NOW,
      ),
    ).toEqual({ muxLiveStreamId: "ls_1", status: "active" });
  });

  it("maps live_stream.idle → status ended with endedAt (authoritative end)", () => {
    expect(
      mapMuxEventToUpdate(
        { type: "video.live_stream.idle", data: { id: "ls_1" } },
        NOW,
      ),
    ).toEqual({ muxLiveStreamId: "ls_1", status: "ended", endedAt: NOW });
  });

  it("does NOT end on disconnected (transient — reconnect window)", () => {
    expect(
      mapMuxEventToUpdate(
        { type: "video.live_stream.disconnected", data: { id: "ls_1" } },
        NOW,
      ),
    ).toBeNull();
  });

  it("maps asset.ready (with live_stream_id) → attach vodAssetId only", () => {
    expect(
      mapMuxEventToUpdate(
        {
          type: "video.asset.ready",
          data: { id: "asset_9", live_stream_id: "ls_1" },
        },
        NOW,
      ),
    ).toEqual({ muxLiveStreamId: "ls_1", vodAssetId: "asset_9" });
  });

  it("attaches the asset's PUBLIC playback id on asset.ready (WSM-000198)", () => {
    expect(
      mapMuxEventToUpdate(
        {
          type: "video.asset.ready",
          data: {
            id: "asset_9",
            live_stream_id: "ls_1",
            playback_ids: [
              { id: "pb_signed", policy: "signed" },
              { id: "pb_public", policy: "public" },
            ],
          },
        },
        NOW,
      ),
    ).toEqual({
      muxLiveStreamId: "ls_1",
      vodAssetId: "asset_9",
      vodPlaybackId: "pb_public",
    });
  });

  it("attaches VOD ids on asset.live_stream_completed (finalized recording)", () => {
    expect(
      mapMuxEventToUpdate(
        {
          type: "video.asset.live_stream_completed",
          data: {
            id: "asset_9",
            live_stream_id: "ls_1",
            playback_ids: [{ id: "pb_public", policy: "public" }],
          },
        },
        NOW,
      ),
    ).toEqual({
      muxLiveStreamId: "ls_1",
      vodAssetId: "asset_9",
      vodPlaybackId: "pb_public",
    });
  });

  it("omits vodPlaybackId when the asset has no PUBLIC playback id", () => {
    expect(
      mapMuxEventToUpdate(
        {
          type: "video.asset.ready",
          data: {
            id: "asset_9",
            live_stream_id: "ls_1",
            playback_ids: [{ id: "pb_signed", policy: "signed" }],
          },
        },
        NOW,
      ),
    ).toEqual({ muxLiveStreamId: "ls_1", vodAssetId: "asset_9" });
  });

  it("ignores asset.ready for uploads (no live_stream_id)", () => {
    expect(
      mapMuxEventToUpdate(
        { type: "video.asset.ready", data: { id: "asset_9" } },
        NOW,
      ),
    ).toBeNull();
  });

  it("ignores unknown event types", () => {
    expect(
      mapMuxEventToUpdate(
        { type: "video.live_stream.connected", data: { id: "ls_1" } },
        NOW,
      ),
    ).toBeNull();
  });

  it("ignores events missing the live-stream id", () => {
    expect(
      mapMuxEventToUpdate({ type: "video.live_stream.active", data: {} }, NOW),
    ).toBeNull();
  });
});

describe("handleMuxEvent (side effect)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("applies a mapped update via updateGameStreamStatus", async () => {
    await handleMuxEvent({
      type: "video.live_stream.active",
      data: { id: "ls_1" },
    });
    expect(mockUpdateGameStreamStatus).toHaveBeenCalledWith({
      muxLiveStreamId: "ls_1",
      status: "active",
    });
  });

  it("is a no-op for ignored events (no write)", async () => {
    await handleMuxEvent({
      type: "video.live_stream.disconnected",
      data: { id: "ls_1" },
    });
    expect(mockUpdateGameStreamStatus).not.toHaveBeenCalled();
  });
});

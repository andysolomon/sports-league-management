import { describe, it, expect } from "vitest";
import { resolveStreamView } from "../stream-view";
import type { PublicGameStream } from "@/lib/data-api";

const base: PublicGameStream = {
  status: "idle",
  provider: "mux",
  muxPlaybackId: "pb_live",
  youtubeVideoId: null,
  vodAssetId: null,
  vodPlaybackId: null,
};

describe("resolveStreamView (pure replay-vs-live decision, WSM-000198)", () => {
  it("no stream → none", () => {
    expect(resolveStreamView(null)).toEqual({
      mode: "none",
      muxPlaybackId: null,
      youtubeVideoId: null,
    });
  });

  it("idle stream → none (nothing public to show yet)", () => {
    expect(resolveStreamView(base).mode).toBe("none");
  });

  it("active mux stream → live with the LIVE playback id", () => {
    expect(resolveStreamView({ ...base, status: "active" })).toEqual({
      mode: "live",
      muxPlaybackId: "pb_live",
      youtubeVideoId: null,
    });
  });

  it("ended mux stream with a VOD playback id → replay playing the VOD id, not the live id", () => {
    expect(
      resolveStreamView({
        ...base,
        status: "ended",
        vodAssetId: "asset_9",
        vodPlaybackId: "pb_vod",
      }),
    ).toEqual({
      mode: "replay",
      muxPlaybackId: "pb_vod",
      youtubeVideoId: null,
    });
  });

  it("ended mux stream WITHOUT a VOD playback id → ended-no-replay (even if the asset id landed)", () => {
    // Legacy rows / asset webhooks not yet delivered: the live playback id
    // cannot serve the recording, so there is nothing playable.
    expect(
      resolveStreamView({ ...base, status: "ended", vodAssetId: "asset_9" })
        .mode,
    ).toBe("ended-no-replay");
  });

  it("ended youtube stream → replay via the same video id", () => {
    expect(
      resolveStreamView({
        ...base,
        provider: "youtube",
        muxPlaybackId: null,
        youtubeVideoId: "yt_1",
        status: "ended",
      }),
    ).toEqual({
      mode: "replay",
      muxPlaybackId: null,
      youtubeVideoId: "yt_1",
    });
  });

  it("ended youtube stream without a video id → ended-no-replay", () => {
    expect(
      resolveStreamView({
        ...base,
        provider: "youtube",
        muxPlaybackId: null,
        status: "ended",
      }).mode,
    ).toBe("ended-no-replay");
  });
});

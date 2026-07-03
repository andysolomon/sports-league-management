import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockLiveStreamingV1,
  mockAuth,
  mockGetFixture,
  mockGetPublicSeason,
  mockCanAdministerTeam,
  mockGetStreamByFixture,
  mockListClipsAdminByFixture,
  mockCreateGameClip,
  mockDeleteGameClip,
  mockCreateMuxClip,
  mockDeleteMuxAsset,
} = vi.hoisted(() => ({
  mockLiveStreamingV1: vi.fn(),
  mockAuth: vi.fn(),
  mockGetFixture: vi.fn(),
  mockGetPublicSeason: vi.fn(),
  mockCanAdministerTeam: vi.fn(),
  mockGetStreamByFixture: vi.fn(),
  mockListClipsAdminByFixture: vi.fn(),
  mockCreateGameClip: vi.fn(),
  mockDeleteGameClip: vi.fn(),
  mockCreateMuxClip: vi.fn(),
  mockDeleteMuxAsset: vi.fn(),
}));

// stream-auth.ts (the shared auth chain) is `import "server-only"`.
vi.mock("server-only", () => ({}));
vi.mock("@/lib/flags", () => ({ liveStreamingV1: mockLiveStreamingV1 }));
vi.mock("@clerk/nextjs/server", () => ({ auth: mockAuth }));
vi.mock("@/lib/data-api", () => ({
  getFixture: mockGetFixture,
  getPublicSeason: mockGetPublicSeason,
  getStreamByFixture: mockGetStreamByFixture,
  listClipsAdminByFixture: mockListClipsAdminByFixture,
  createGameClip: mockCreateGameClip,
  deleteGameClip: mockDeleteGameClip,
}));
vi.mock("@/lib/authorization", () => ({
  canAdministerTeam: mockCanAdministerTeam,
}));
vi.mock("@/lib/mux", () => ({
  createMuxClip: mockCreateMuxClip,
  deleteMuxAsset: mockDeleteMuxAsset,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { createClip, deleteClip, getClipsForAdmin } from "../clip-actions";

const LEAGUE = "league_1";
const FIXTURE = "fixture_1";

function happyFixture() {
  mockLiveStreamingV1.mockResolvedValue(true);
  mockAuth.mockResolvedValue({ userId: "user_1" });
  mockGetFixture.mockResolvedValue({
    id: FIXTURE,
    seasonId: "season_1",
    homeTeamId: "team_home",
    awayTeamId: "team_away",
    homeTeamName: "Home",
    awayTeamName: "Away",
    status: "final",
  });
  mockGetPublicSeason.mockResolvedValue({ id: "season_1", leagueId: LEAGUE });
  mockCanAdministerTeam.mockResolvedValue(true);
  mockGetStreamByFixture.mockResolvedValue({
    status: "ended",
    provider: "mux",
    muxPlaybackId: "pb_live",
    youtubeVideoId: null,
    vodAssetId: "asset_9",
    vodPlaybackId: "pb_vod",
  });
  mockListClipsAdminByFixture.mockResolvedValue([]);
  mockCreateMuxClip.mockResolvedValue({
    assetId: "clip_asset_1",
    playbackId: "pb_clip",
  });
  mockCreateGameClip.mockResolvedValue({ id: "clip_1" });
}

const RANGE = { startSec: 60, endSec: 90, label: "Big touchdown" };

describe("createClip", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    happyFixture();
  });

  it("cuts the clip from the stream's VOD asset and persists the row", async () => {
    const res = await createClip(LEAGUE, FIXTURE, RANGE);
    expect(res).toEqual({ ok: true });
    expect(mockCreateMuxClip).toHaveBeenCalledWith("asset_9", 60, 90);
    expect(mockCreateGameClip).toHaveBeenCalledWith({
      fixtureId: FIXTURE,
      muxAssetId: "clip_asset_1",
      playbackId: "pb_clip",
      label: "Big touchdown",
      startTime: 60,
      endTime: 90,
      createdBy: "user_1",
    });
  });

  it("refuses when the dark flag is off (no Mux call)", async () => {
    mockLiveStreamingV1.mockResolvedValue(false);
    const res = await createClip(LEAGUE, FIXTURE, RANGE);
    expect(res).toEqual({ ok: false, error: "flag_disabled" });
    expect(mockCreateMuxClip).not.toHaveBeenCalled();
  });

  it("refuses signed-out callers", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const res = await createClip(LEAGUE, FIXTURE, RANGE);
    expect(res).toEqual({ ok: false, error: "unauthorized" });
  });

  it("refuses non-admins of both teams", async () => {
    mockCanAdministerTeam.mockResolvedValue(false);
    const res = await createClip(LEAGUE, FIXTURE, RANGE);
    expect(res).toEqual({ ok: false, error: "not_authorized" });
  });

  it("refuses a fixture from another league (cross-league guard)", async () => {
    mockGetPublicSeason.mockResolvedValue({
      id: "season_1",
      leagueId: "other_league",
    });
    const res = await createClip(LEAGUE, FIXTURE, RANGE);
    expect(res).toEqual({ ok: false, error: "fixture_not_in_league" });
  });

  it.each([
    ["end before start", { startSec: 90, endSec: 60 }],
    ["zero length", { startSec: 60, endSec: 60 }],
    ["negative start", { startSec: -5, endSec: 30 }],
    ["over the 10-minute cap", { startSec: 0, endSec: 601 }],
    ["non-finite", { startSec: Number.NaN, endSec: 30 }],
  ])("rejects an invalid range: %s", async (_name, range) => {
    const res = await createClip(LEAGUE, FIXTURE, {
      ...range,
      label: "Clip",
    });
    expect(res).toEqual({ ok: false, error: "invalid_clip_range" });
    expect(mockCreateMuxClip).not.toHaveBeenCalled();
  });

  it("rejects a blank or over-long label", async () => {
    expect(
      await createClip(LEAGUE, FIXTURE, { ...RANGE, label: "   " }),
    ).toEqual({ ok: false, error: "invalid_label" });
    expect(
      await createClip(LEAGUE, FIXTURE, { ...RANGE, label: "x".repeat(81) }),
    ).toEqual({ ok: false, error: "invalid_label" });
  });

  it("refuses when there is no Mux recording (YouTube stream)", async () => {
    mockGetStreamByFixture.mockResolvedValue({
      status: "ended",
      provider: "youtube",
      muxPlaybackId: null,
      youtubeVideoId: "yt_1",
      vodAssetId: null,
      vodPlaybackId: null,
    });
    const res = await createClip(LEAGUE, FIXTURE, RANGE);
    expect(res).toEqual({ ok: false, error: "no_recording" });
  });

  it("refuses when the VOD hasn't landed yet", async () => {
    mockGetStreamByFixture.mockResolvedValue({
      status: "active",
      provider: "mux",
      muxPlaybackId: "pb_live",
      youtubeVideoId: null,
      vodAssetId: null,
      vodPlaybackId: null,
    });
    const res = await createClip(LEAGUE, FIXTURE, RANGE);
    expect(res).toEqual({ ok: false, error: "no_recording" });
  });

  it("enforces the per-fixture clip cap", async () => {
    mockListClipsAdminByFixture.mockResolvedValue(
      Array.from({ length: 20 }, (_, i) => ({ id: `clip_${i}` })),
    );
    const res = await createClip(LEAGUE, FIXTURE, RANGE);
    expect(res).toEqual({ ok: false, error: "clip_cap_reached" });
    expect(mockCreateMuxClip).not.toHaveBeenCalled();
  });

  it("surfaces Mux failures as an error result, not a throw", async () => {
    mockCreateMuxClip.mockRejectedValue(new Error("mux_down"));
    const res = await createClip(LEAGUE, FIXTURE, RANGE);
    expect(res).toEqual({ ok: false, error: "mux_down" });
    expect(mockCreateGameClip).not.toHaveBeenCalled();
  });
});

describe("deleteClip", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    happyFixture();
    mockListClipsAdminByFixture.mockResolvedValue([
      {
        id: "clip_1",
        muxAssetId: "clip_asset_1",
        playbackId: "pb_clip",
        label: "Big touchdown",
        startTime: 60,
        endTime: 90,
        status: "ready",
        createdAt: "2026-07-03T00:00:00.000Z",
      },
    ]);
    mockDeleteGameClip.mockResolvedValue(true);
    mockDeleteMuxAsset.mockResolvedValue(undefined);
  });

  it("tears down the Mux asset then removes the row", async () => {
    const res = await deleteClip(LEAGUE, FIXTURE, "clip_1");
    expect(res).toEqual({ ok: true });
    expect(mockDeleteMuxAsset).toHaveBeenCalledWith("clip_asset_1");
    expect(mockDeleteGameClip).toHaveBeenCalledWith("clip_1", FIXTURE);
  });

  it("refuses a clip id that doesn't belong to this fixture", async () => {
    const res = await deleteClip(LEAGUE, FIXTURE, "clip_other");
    expect(res).toEqual({ ok: false, error: "clip_not_found" });
    expect(mockDeleteMuxAsset).not.toHaveBeenCalled();
  });

  it("runs the same auth chain as creation", async () => {
    mockCanAdministerTeam.mockResolvedValue(false);
    const res = await deleteClip(LEAGUE, FIXTURE, "clip_1");
    expect(res).toEqual({ ok: false, error: "not_authorized" });
  });
});

describe("getClipsForAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    happyFixture();
  });

  it("returns clips WITHOUT the server-side Mux asset id", async () => {
    mockListClipsAdminByFixture.mockResolvedValue([
      {
        id: "clip_1",
        muxAssetId: "clip_asset_1",
        playbackId: "pb_clip",
        label: "Big touchdown",
        startTime: 60,
        endTime: 90,
        status: "ready",
        createdAt: "2026-07-03T00:00:00.000Z",
      },
    ]);
    const res = await getClipsForAdmin(LEAGUE, FIXTURE);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.clips).toHaveLength(1);
      expect(res.clips[0]).not.toHaveProperty("muxAssetId");
      expect(res.clips[0]).toMatchObject({
        id: "clip_1",
        playbackId: "pb_clip",
        status: "ready",
      });
    }
  });

  it("is gated by the same auth chain", async () => {
    mockLiveStreamingV1.mockResolvedValue(false);
    const res = await getClipsForAdmin(LEAGUE, FIXTURE);
    expect(res).toEqual({ ok: false, error: "flag_disabled" });
    expect(mockListClipsAdminByFixture).not.toHaveBeenCalled();
  });
});

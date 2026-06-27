import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockLiveStreamingV1,
  mockAuth,
  mockGetFixture,
  mockGetPublicSeason,
  mockCreateGameStream,
  mockUpdateGameStreamStatus,
  mockEndGameStreamByFixture,
  mockGetActiveStreamCountForLeague,
  mockGetStreamAdminByFixture,
  mockCanAdministerTeam,
  mockCreateMuxLiveStream,
  mockDisableMuxLiveStream,
} = vi.hoisted(() => ({
  mockLiveStreamingV1: vi.fn(),
  mockAuth: vi.fn(),
  mockGetFixture: vi.fn(),
  mockGetPublicSeason: vi.fn(),
  mockCreateGameStream: vi.fn(),
  mockUpdateGameStreamStatus: vi.fn(),
  mockEndGameStreamByFixture: vi.fn(),
  mockGetActiveStreamCountForLeague: vi.fn(),
  mockGetStreamAdminByFixture: vi.fn(),
  mockCanAdministerTeam: vi.fn(),
  mockCreateMuxLiveStream: vi.fn(),
  mockDisableMuxLiveStream: vi.fn(),
}));

vi.mock("@/lib/flags", () => ({ liveStreamingV1: mockLiveStreamingV1 }));
vi.mock("@clerk/nextjs/server", () => ({ auth: mockAuth }));
vi.mock("@/lib/data-api", () => ({
  getFixture: mockGetFixture,
  getPublicSeason: mockGetPublicSeason,
  createGameStream: mockCreateGameStream,
  updateGameStreamStatus: mockUpdateGameStreamStatus,
  endGameStreamByFixture: mockEndGameStreamByFixture,
  getActiveStreamCountForLeague: mockGetActiveStreamCountForLeague,
  getStreamAdminByFixture: mockGetStreamAdminByFixture,
}));
vi.mock("@/lib/authorization", () => ({
  canAdministerTeam: mockCanAdministerTeam,
}));
vi.mock("@/lib/mux", () => ({
  createMuxLiveStream: mockCreateMuxLiveStream,
  disableMuxLiveStream: mockDisableMuxLiveStream,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import {
  startGameStream,
  startYoutubeStream,
  stopGameStream,
} from "../stream-actions";

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
  });
  mockGetPublicSeason.mockResolvedValue({ id: "season_1", leagueId: LEAGUE });
}

describe("startGameStream", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    happyFixture();
    mockCanAdministerTeam.mockResolvedValue(true);
    mockGetActiveStreamCountForLeague.mockResolvedValue(0);
    mockCreateMuxLiveStream.mockResolvedValue({
      liveStreamId: "ls_1",
      streamKey: "sk_secret",
      playbackId: "pb_1",
      rtmpUrl: "rtmps://global-live.mux.com:443/app",
    });
    mockCreateGameStream.mockResolvedValue({
      id: "gs_1",
      fixtureId: FIXTURE,
      status: "idle",
      muxPlaybackId: "pb_1",
    });
  });

  it("blocks when the dark flag is off", async () => {
    mockLiveStreamingV1.mockResolvedValue(false);
    const res = await startGameStream(LEAGUE, FIXTURE);
    expect(res).toEqual({ ok: false, error: "flag_disabled" });
    expect(mockCreateMuxLiveStream).not.toHaveBeenCalled();
  });

  it("blocks an unauthenticated caller", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    expect(await startGameStream(LEAGUE, FIXTURE)).toEqual({
      ok: false,
      error: "unauthorized",
    });
  });

  it("404s a fixture from another league (cross-league guard)", async () => {
    mockGetPublicSeason.mockResolvedValue({
      id: "season_1",
      leagueId: "other_league",
    });
    expect(await startGameStream(LEAGUE, FIXTURE)).toEqual({
      ok: false,
      error: "fixture_not_in_league",
    });
    expect(mockCreateMuxLiveStream).not.toHaveBeenCalled();
  });

  it("rejects a caller who administers neither team", async () => {
    mockCanAdministerTeam.mockResolvedValue(false);
    expect(await startGameStream(LEAGUE, FIXTURE)).toEqual({
      ok: false,
      error: "not_authorized",
    });
  });

  it("enforces the per-league concurrent cap", async () => {
    mockGetActiveStreamCountForLeague.mockResolvedValue(3);
    expect(await startGameStream(LEAGUE, FIXTURE)).toEqual({
      ok: false,
      error: "stream_cap_reached",
    });
    expect(mockCreateMuxLiveStream).not.toHaveBeenCalled();
  });

  it("returns the rtmp url + key to the starter and persists the stream", async () => {
    const res = await startGameStream(LEAGUE, FIXTURE);
    expect(res).toEqual({
      ok: true,
      rtmpUrl: "rtmps://global-live.mux.com:443/app",
      streamKey: "sk_secret",
      playbackId: "pb_1",
    });
    expect(mockCreateGameStream).toHaveBeenCalledWith({
      fixtureId: FIXTURE,
      muxLiveStreamId: "ls_1",
      muxPlaybackId: "pb_1",
      startedBy: "user_1",
      maxDurationMinutes: 180,
    });
  });
});

describe("startYoutubeStream", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    happyFixture();
    mockCanAdministerTeam.mockResolvedValue(true);
    mockGetActiveStreamCountForLeague.mockResolvedValue(0);
    mockCreateGameStream.mockResolvedValue({
      id: "gs_1",
      fixtureId: FIXTURE,
      status: "active",
    });
  });

  it("persists a youtube stream from a pasted watch URL", async () => {
    const res = await startYoutubeStream(
      LEAGUE,
      FIXTURE,
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    );
    expect(res).toEqual({ ok: true });
    expect(mockCreateGameStream).toHaveBeenCalledWith({
      fixtureId: FIXTURE,
      provider: "youtube",
      youtubeVideoId: "dQw4w9WgXcQ",
      startedBy: "user_1",
      maxDurationMinutes: 180,
    });
  });

  it("rejects a non-YouTube link without persisting", async () => {
    expect(
      await startYoutubeStream(LEAGUE, FIXTURE, "https://vimeo.com/123"),
    ).toEqual({ ok: false, error: "invalid_youtube_url" });
    expect(mockCreateGameStream).not.toHaveBeenCalled();
  });

  it("enforces the per-league concurrent cap", async () => {
    mockGetActiveStreamCountForLeague.mockResolvedValue(3);
    expect(
      await startYoutubeStream(
        LEAGUE,
        FIXTURE,
        "https://youtu.be/dQw4w9WgXcQ",
      ),
    ).toEqual({ ok: false, error: "stream_cap_reached" });
    expect(mockCreateGameStream).not.toHaveBeenCalled();
  });

  it("blocks when the dark flag is off", async () => {
    mockLiveStreamingV1.mockResolvedValue(false);
    expect(
      await startYoutubeStream(LEAGUE, FIXTURE, "https://youtu.be/dQw4w9WgXcQ"),
    ).toEqual({ ok: false, error: "flag_disabled" });
  });
});

describe("stopGameStream", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    happyFixture();
    mockCanAdministerTeam.mockResolvedValue(true);
  });

  it("disables the Mux stream and marks it ended", async () => {
    mockGetStreamAdminByFixture.mockResolvedValue({
      provider: "mux",
      muxLiveStreamId: "ls_1",
      status: "active",
    });
    const res = await stopGameStream(LEAGUE, FIXTURE);
    expect(res).toEqual({ ok: true });
    expect(mockDisableMuxLiveStream).toHaveBeenCalledWith("ls_1");
    expect(mockUpdateGameStreamStatus).toHaveBeenCalledWith(
      expect.objectContaining({ muxLiveStreamId: "ls_1", status: "ended" }),
    );
  });

  it("ends a youtube stream without touching Mux", async () => {
    mockGetStreamAdminByFixture.mockResolvedValue({
      provider: "youtube",
      muxLiveStreamId: null,
      status: "active",
    });
    const res = await stopGameStream(LEAGUE, FIXTURE);
    expect(res).toEqual({ ok: true });
    expect(mockEndGameStreamByFixture).toHaveBeenCalledWith(
      FIXTURE,
      expect.any(String),
    );
    expect(mockDisableMuxLiveStream).not.toHaveBeenCalled();
  });

  it("returns stream_not_found when there is no stream", async () => {
    mockGetStreamAdminByFixture.mockResolvedValue(null);
    expect(await stopGameStream(LEAGUE, FIXTURE)).toEqual({
      ok: false,
      error: "stream_not_found",
    });
    expect(mockDisableMuxLiveStream).not.toHaveBeenCalled();
  });
});

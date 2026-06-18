import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockLiveScoringV1,
  mockGetFixture,
  mockGetLeagueVisibility,
  mockGetPublicSeason,
  mockGetLiveGameState,
} = vi.hoisted(() => ({
  mockLiveScoringV1: vi.fn(),
  mockGetFixture: vi.fn(),
  mockGetLeagueVisibility: vi.fn(),
  mockGetPublicSeason: vi.fn(),
  mockGetLiveGameState: vi.fn(),
}));

vi.mock("@/lib/flags", () => ({ liveScoringV1: mockLiveScoringV1 }));
vi.mock("@/lib/data-api", () => ({
  getFixture: mockGetFixture,
  getLeagueVisibility: mockGetLeagueVisibility,
  getPublicSeason: mockGetPublicSeason,
  getLiveGameState: mockGetLiveGameState,
}));

import { GET } from "../route";

const LEAGUE = "lg_1";
const GAME = "fixture_1";

const params = Promise.resolve({ id: LEAGUE, gameId: GAME });
const req = new Request("https://x/leagues/lg_1/games/fixture_1/live-score");
const call = () => GET(req, { params });

const LIVE = {
  homeScore: 14,
  awayScore: 7,
  period: 2,
  clock: "03:21",
  status: "in_progress",
};

function happy() {
  mockLiveScoringV1.mockResolvedValue(true);
  mockGetLeagueVisibility.mockResolvedValue({ isPublic: true });
  mockGetFixture.mockResolvedValue({ id: GAME, seasonId: "season_1" });
  mockGetPublicSeason.mockResolvedValue({ id: "season_1", leagueId: LEAGUE });
  mockGetLiveGameState.mockResolvedValue(LIVE);
}

beforeEach(() => {
  vi.clearAllMocks();
  happy();
});

describe("GET /leagues/[id]/games/[gameId]/live-score", () => {
  it("404s when the flag is off", async () => {
    mockLiveScoringV1.mockResolvedValue(false);
    const res = await call();
    expect(res.status).toBe(404);
    expect(mockGetLiveGameState).not.toHaveBeenCalled();
  });

  it("404s when the league isn't public", async () => {
    mockGetLeagueVisibility.mockResolvedValue({ isPublic: false });
    const res = await call();
    expect(res.status).toBe(404);
    expect(mockGetLiveGameState).not.toHaveBeenCalled();
  });

  it("404s when the fixture doesn't exist", async () => {
    mockGetFixture.mockResolvedValue(null);
    expect((await call()).status).toBe(404);
  });

  it("404s on a cross-league fixture (leak guard)", async () => {
    mockGetPublicSeason.mockResolvedValue({
      id: "season_1",
      leagueId: "other_league",
    });
    const res = await call();
    expect(res.status).toBe(404);
    expect(mockGetLiveGameState).not.toHaveBeenCalled();
  });

  it("returns the live projection for a public, in-league fixture", async () => {
    const res = await call();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ live: LIVE });
    expect(res.headers.get("Cache-Control")).toContain("s-maxage=3");
  });

  it("returns { live: null } before kickoff", async () => {
    mockGetLiveGameState.mockResolvedValue(null);
    const res = await call();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ live: null });
  });
});

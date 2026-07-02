import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockLiveScoringV1, mockGetPublicLiveGameState } = vi.hoisted(() => ({
  mockLiveScoringV1: vi.fn(),
  mockGetPublicLiveGameState: vi.fn(),
}));

vi.mock("@/lib/flags", () => ({ liveScoringV1: mockLiveScoringV1 }));
vi.mock("@/lib/data-api", () => ({
  getPublicLiveGameState: mockGetPublicLiveGameState,
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
  // One Convex call does the public + cross-league guard AND the live-state
  // read (WSM-000192); a non-null result means every guard passed.
  mockGetPublicLiveGameState.mockResolvedValue({ live: LIVE });
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
    expect(mockGetPublicLiveGameState).not.toHaveBeenCalled();
  });

  it("404s when the guarded read denies (private league / missing / cross-league fixture)", async () => {
    mockGetPublicLiveGameState.mockResolvedValue(null);
    expect((await call()).status).toBe(404);
  });

  it("404s when the read throws (e.g. invalid Convex id)", async () => {
    mockGetPublicLiveGameState.mockRejectedValue(
      new Error("ArgumentValidationError"),
    );
    expect((await call()).status).toBe(404);
  });

  it("returns the live projection for a public, in-league fixture", async () => {
    const res = await call();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ live: LIVE });
    expect(res.headers.get("Cache-Control")).toContain("s-maxage=10");
    expect(mockGetPublicLiveGameState).toHaveBeenCalledWith(LEAGUE, GAME);
  });

  it("returns { live: null } before kickoff", async () => {
    mockGetPublicLiveGameState.mockResolvedValue({ live: null });
    const res = await call();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ live: null });
  });
});

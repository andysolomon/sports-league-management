import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockLiveScoringV1,
  mockAuth,
  mockGetFixture,
  mockStartLiveGame,
  mockAddLiveScore,
  mockUpdateLiveState,
  mockEndLiveGame,
  mockCanManageTeam,
} = vi.hoisted(() => ({
  mockLiveScoringV1: vi.fn(),
  mockAuth: vi.fn(),
  mockGetFixture: vi.fn(),
  mockStartLiveGame: vi.fn(),
  mockAddLiveScore: vi.fn(),
  mockUpdateLiveState: vi.fn(),
  mockEndLiveGame: vi.fn(),
  mockCanManageTeam: vi.fn(),
}));

vi.mock("@/lib/flags", () => ({ liveScoringV1: mockLiveScoringV1 }));
vi.mock("@clerk/nextjs/server", () => ({ auth: mockAuth }));
vi.mock("@/lib/data-api", () => ({
  getFixture: mockGetFixture,
  startLiveGame: mockStartLiveGame,
  addLiveScore: mockAddLiveScore,
  updateLiveState: mockUpdateLiveState,
  endLiveGame: mockEndLiveGame,
}));
vi.mock("@/lib/authorization", () => ({ canManageTeam: mockCanManageTeam }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import {
  startLiveGameAction,
  addLiveScoreAction,
  updateLiveStateAction,
  endLiveGameAction,
} from "../actions";

const TEAM = "team_home";
const FIX = "fixture_1";

const STATE = {
  id: "lgs_1",
  fixtureId: FIX,
  homeScore: 6,
  awayScore: 0,
  period: 1,
  clock: null,
  status: "in_progress",
  startedBy: "user_1",
  startedAt: "2026-06-18T00:00:00.000Z",
  updatedAt: "2026-06-18T00:00:00.000Z",
};

function happy() {
  mockLiveScoringV1.mockResolvedValue(true);
  mockAuth.mockResolvedValue({ userId: "user_1" });
  mockGetFixture.mockResolvedValue({
    id: FIX,
    seasonId: "season_1",
    homeTeamId: TEAM,
    awayTeamId: "team_away",
  });
  mockCanManageTeam.mockResolvedValue(true);
  mockStartLiveGame.mockResolvedValue(STATE);
  mockAddLiveScore.mockResolvedValue(STATE);
  mockUpdateLiveState.mockResolvedValue(STATE);
  mockEndLiveGame.mockResolvedValue({ ...STATE, status: "final" });
}

beforeEach(() => {
  vi.clearAllMocks();
  happy();
});

// All four actions share the same authorize() guard — exercise it once per
// branch through startLiveGameAction, then spot-check each action's forward.
describe("authorize (via startLiveGameAction)", () => {
  const call = () => startLiveGameAction({ teamId: TEAM, fixtureId: FIX });

  it("blocks when the flag is off", async () => {
    mockLiveScoringV1.mockResolvedValue(false);
    expect(await call()).toEqual({ ok: false, error: "flag_disabled" });
    expect(mockStartLiveGame).not.toHaveBeenCalled();
  });

  it("blocks an unauthenticated caller", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    expect(await call()).toEqual({ ok: false, error: "unauthorized" });
  });

  it("404s a fixture that doesn't exist", async () => {
    mockGetFixture.mockResolvedValue(null);
    expect(await call()).toEqual({ ok: false, error: "fixture_not_found" });
  });

  it("rejects a team not in the fixture (cross-fixture guard)", async () => {
    mockGetFixture.mockResolvedValue({
      id: FIX,
      seasonId: "season_1",
      homeTeamId: "other_a",
      awayTeamId: "other_b",
    });
    expect(await call()).toEqual({ ok: false, error: "team_not_in_fixture" });
    expect(mockStartLiveGame).not.toHaveBeenCalled();
  });

  it("rejects a caller who can't manage the team", async () => {
    mockCanManageTeam.mockResolvedValue(false);
    expect(await call()).toEqual({ ok: false, error: "not_authorized" });
    expect(mockStartLiveGame).not.toHaveBeenCalled();
  });
});

describe("startLiveGameAction", () => {
  it("starts the game with the actor and returns state", async () => {
    const res = await startLiveGameAction({ teamId: TEAM, fixtureId: FIX });
    expect(res).toEqual({ ok: true, state: STATE });
    expect(mockStartLiveGame).toHaveBeenCalledWith(FIX, "user_1");
  });
});

describe("addLiveScoreAction", () => {
  it("forwards the scoring event", async () => {
    const res = await addLiveScoreAction({
      teamId: TEAM,
      fixtureId: FIX,
      team: "home",
      points: 6,
    });
    expect(res).toEqual({ ok: true, state: STATE });
    expect(mockAddLiveScore).toHaveBeenCalledWith(FIX, "home", 6);
  });

  it("returns the error when Convex rejects the points", async () => {
    mockAddLiveScore.mockRejectedValue(new Error("invalid_points"));
    const res = await addLiveScoreAction({
      teamId: TEAM,
      fixtureId: FIX,
      team: "away",
      points: 4,
    });
    expect(res).toEqual({ ok: false, error: "invalid_points" });
  });
});

describe("updateLiveStateAction", () => {
  it("forwards the patch", async () => {
    const res = await updateLiveStateAction({
      teamId: TEAM,
      fixtureId: FIX,
      patch: { status: "halftime", period: 2 },
    });
    expect(res).toEqual({ ok: true, state: STATE });
    expect(mockUpdateLiveState).toHaveBeenCalledWith(FIX, {
      status: "halftime",
      period: 2,
    });
  });
});

describe("endLiveGameAction", () => {
  it("ends the game and returns the final state", async () => {
    const res = await endLiveGameAction({ teamId: TEAM, fixtureId: FIX });
    expect(res).toEqual({ ok: true, state: { ...STATE, status: "final" } });
    expect(mockEndLiveGame).toHaveBeenCalledWith(FIX, "user_1");
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the Convex client + nflverse fetch so we test the orchestrator's
// branching (skip-on-no-matches, clear-then-write) without network/DB.
const queryMock = vi.fn();
const mutationMock = vi.fn();
vi.mock("../convex-client", () => ({
  getConvexClient: () => ({ query: queryMock, mutation: mutationMock }),
}));

const ratingsByEspn = new Map([
  ["111", { positionGroup: "QB" as const, overall: 88, attributes: { efficiency: 90 } }],
]);
vi.mock("../ratings/nflverse", async (orig) => {
  const actual = (await orig()) as object;
  return {
    ...actual,
    resolveLatestDataYear: vi.fn(async () => 2025),
    fetchSprtRatingsByEspnId: vi.fn(async () => ratingsByEspn),
  };
});

import { refreshSprtRatings } from "../ratings/sprt-refresh";

beforeEach(() => {
  queryMock.mockReset();
  mutationMock.mockReset();
});

function wireQueries(opts: {
  leagues: { id: string; name: string }[];
  seasons: Record<string, { id: string; status: string }[]>;
  teams: Record<string, { id: string }[]>;
  players: Record<string, { id: string; headshotUrl: string | null }[]>;
}) {
  queryMock.mockImplementation((_ref: unknown, args: Record<string, unknown>) => {
    if (args && "leagueIds" in args) return opts.seasons[(args.leagueIds as string[])[0]] ?? [];
    if (args && "leagueId" in args) return opts.teams[args.leagueId as string] ?? [];
    if (args && "teamId" in args) return opts.players[args.teamId as string] ?? [];
    return opts.leagues; // listPublicLeagues ({} args)
  });
}

describe("refreshSprtRatings (WSM-000092)", () => {
  it("clears and writes for a league with matches", async () => {
    wireQueries({
      leagues: [{ id: "L1", name: "NFL" }],
      seasons: { L1: [{ id: "S1", status: "active" }] },
      teams: { L1: [{ id: "T1" }] },
      players: {
        T1: [
          { id: "p1", headshotUrl: "https://a.espncdn.com/i/headshots/nfl/players/full/111.png" },
          { id: "p2", headshotUrl: "https://a.espncdn.com/i/headshots/nfl/players/full/999.png" },
        ],
      },
    });
    mutationMock.mockImplementation((_ref: unknown, args: Record<string, unknown>) =>
      "rows" in args ? { created: (args.rows as unknown[]).length, updated: 0 } : { deleted: 5 },
    );

    const report = await refreshSprtRatings(new Date(Date.UTC(2026, 5, 12)));
    expect(report.dataYear).toBe(2025);
    expect(report.leagues[0].matched).toBe(1); // only p1's espn id (111) has a rating
    expect(report.leagues[0].cleared).toBe(5);
    expect(report.leagues[0].written).toBe(1);
  });

  it("skips a league with zero matches without clearing", async () => {
    wireQueries({
      leagues: [{ id: "L2", name: "Rec League" }],
      seasons: { L2: [{ id: "S2", status: "active" }] },
      teams: { L2: [{ id: "T9" }] },
      players: { T9: [{ id: "x", headshotUrl: null }] },
    });

    const report = await refreshSprtRatings(new Date(Date.UTC(2026, 5, 12)));
    expect(report.leagues[0].skipped).toBe("no nflverse matches");
    expect(report.leagues[0].cleared).toBe(0);
    expect(mutationMock).not.toHaveBeenCalled();
  });

  it("skips a league with no season", async () => {
    wireQueries({
      leagues: [{ id: "L3", name: "Empty" }],
      seasons: { L3: [] },
      teams: {},
      players: {},
    });
    const report = await refreshSprtRatings(new Date(Date.UTC(2026, 5, 12)));
    expect(report.leagues[0].skipped).toBe("no season");
    expect(mutationMock).not.toHaveBeenCalled();
  });
});

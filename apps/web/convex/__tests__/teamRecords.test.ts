import { describe, it, expect } from "vitest";
import {
  LAST_RESULTS_LIMIT,
  applyResultDelta,
  buildTeamRecord,
  emptyRecord,
  parseHeadToHead,
  recordsToRankableStats,
  serializeHeadToHead,
  type TeamGameOutcome,
} from "../lib/teamRecords";
import { rankTeamStats } from "../lib/standings";

const win = (opp: string, sameDivision = false): TeamGameOutcome => ({
  opponentTeamId: opp,
  teamScore: 21,
  opponentScore: 7,
  sameDivision,
});
const loss = (opp: string, sameDivision = false): TeamGameOutcome => ({
  opponentTeamId: opp,
  teamScore: 7,
  opponentScore: 21,
  sameDivision,
});
const tie = (opp: string, sameDivision = false): TeamGameOutcome => ({
  opponentTeamId: opp,
  teamScore: 14,
  opponentScore: 14,
  sameDivision,
});

describe("emptyRecord", () => {
  it("starts at zero with no history", () => {
    const r = emptyRecord("t1", "d1");
    expect(r).toMatchObject({
      teamId: "t1",
      divisionId: "d1",
      wins: 0,
      losses: 0,
      ties: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      divisionWins: 0,
      divisionLosses: 0,
      divisionTies: 0,
      streak: 0,
      gamesCounted: 0,
    });
    expect(r.headToHead).toEqual({});
    expect(r.lastResults).toEqual([]);
  });
});

describe("applyResultDelta", () => {
  it("counts a win, a loss and a tie", () => {
    const r = buildTeamRecord({
      teamId: "t1",
      divisionId: "d1",
      outcomes: [win("t2"), loss("t3"), tie("t4")],
    });
    expect(r.wins).toBe(1);
    expect(r.losses).toBe(1);
    expect(r.ties).toBe(1);
    expect(r.gamesCounted).toBe(3);
    expect(r.pointsFor).toBe(21 + 7 + 14);
    expect(r.pointsAgainst).toBe(7 + 21 + 14);
  });

  it("only credits divisional splits for same-division games", () => {
    const r = buildTeamRecord({
      teamId: "t1",
      divisionId: "d1",
      outcomes: [win("t2", true), win("t3", false), loss("t4", true)],
    });
    expect(r.wins).toBe(2);
    expect(r.divisionWins).toBe(1);
    expect(r.divisionLosses).toBe(1);
    expect(r.divisionTies).toBe(0);
  });

  it("accumulates head-to-head per opponent", () => {
    const r = buildTeamRecord({
      teamId: "t1",
      divisionId: null,
      outcomes: [win("t2"), win("t2"), loss("t2"), tie("t3")],
    });
    expect(r.headToHead.t2).toEqual({ w: 2, l: 1, t: 0 });
    expect(r.headToHead.t3).toEqual({ w: 0, l: 0, t: 1 });
  });

  it("extends a win streak and flips sign on a loss", () => {
    const r = buildTeamRecord({
      teamId: "t1",
      divisionId: null,
      outcomes: [win("a"), win("b"), win("c")],
    });
    expect(r.streak).toBe(3);

    const afterLoss = applyResultDelta(r, loss("d"));
    expect(afterLoss.streak).toBe(-1);
    expect(applyResultDelta(afterLoss, loss("e")).streak).toBe(-2);
  });

  it("resets the streak to zero on a tie", () => {
    const r = buildTeamRecord({
      teamId: "t1",
      divisionId: null,
      outcomes: [win("a"), win("b"), tie("c")],
    });
    expect(r.streak).toBe(0);
  });

  it("keeps lastResults newest-first and capped", () => {
    const outcomes = Array.from({ length: LAST_RESULTS_LIMIT + 5 }, (_, i) =>
      i % 2 === 0 ? win(`o${i}`) : loss(`o${i}`),
    );
    const r = buildTeamRecord({ teamId: "t1", divisionId: null, outcomes });

    expect(r.lastResults).toHaveLength(LAST_RESULTS_LIMIT);
    // Final outcome was index 14 (even) => a win, and it must be first.
    expect(r.lastResults[0]).toBe("W");
    expect(r.gamesCounted).toBe(LAST_RESULTS_LIMIT + 5);
  });

  it("does not mutate its input", () => {
    const before = emptyRecord("t1", null);
    const snapshot = structuredClone(before);
    applyResultDelta(before, win("t2"));
    expect(before).toEqual(snapshot);
  });
});

describe("head-to-head serialization", () => {
  it("round-trips", () => {
    const h2h = { t2: { w: 2, l: 1, t: 0 }, t3: { w: 0, l: 0, t: 1 } };
    expect(parseHeadToHead(serializeHeadToHead(h2h))).toEqual(h2h);
  });

  it("degrades to empty rather than throwing on bad input", () => {
    // A cache must never take down a read. Corrupt JSON means "no tiebreak
    // data", which is recoverable, not a 500.
    expect(parseHeadToHead(null)).toEqual({});
    expect(parseHeadToHead(undefined)).toEqual({});
    expect(parseHeadToHead("")).toEqual({});
    expect(parseHeadToHead("not json")).toEqual({});
    expect(parseHeadToHead("[1,2,3]")).toEqual({});
    expect(parseHeadToHead("null")).toEqual({});
  });
});

describe("recordsToRankableStats", () => {
  const teams = [
    { _id: "t1", name: "Alpha", divisionId: "d1" },
    { _id: "t2", name: "Bravo", divisionId: "d1" },
    { _id: "t3", name: "Charlie", divisionId: null },
  ];

  it("includes teams that have no record row yet, at 0-0-0", () => {
    const stats = recordsToRankableStats(teams, []);
    expect(stats).toHaveLength(3);
    for (const s of stats) {
      expect(s.wins).toBe(0);
      expect(s.losses).toBe(0);
      expect(s.headToHead.size).toBe(0);
    }
  });

  it("takes divisionId from the live team row, not the record snapshot", () => {
    const stats = recordsToRankableStats(teams, [
      {
        teamId: "t3",
        wins: 1,
        losses: 0,
        ties: 0,
        pointsFor: 21,
        pointsAgainst: 7,
        divisionWins: 0,
        divisionLosses: 0,
        divisionTies: 0,
        headToHeadJson: serializeHeadToHead({ t1: { w: 1, l: 0, t: 0 } }),
      },
    ]);
    const t3 = stats.find((s) => s.teamId === "t3")!;
    expect(t3.divisionId).toBeNull();
    expect(t3.headToHead.get("t1")).toEqual({ w: 1, l: 0, t: 0 });
  });

  it("feeds rankTeamStats so head-to-head still breaks a tie", () => {
    // Alpha and Bravo are 1-1; Alpha beat Bravo head-to-head, so Alpha ranks
    // ahead even though every other counter is identical.
    const stats = recordsToRankableStats(teams.slice(0, 2), [
      {
        teamId: "t1",
        wins: 1,
        losses: 1,
        ties: 0,
        pointsFor: 28,
        pointsAgainst: 28,
        divisionWins: 1,
        divisionLosses: 1,
        divisionTies: 0,
        headToHeadJson: serializeHeadToHead({ t2: { w: 1, l: 0, t: 0 } }),
      },
      {
        teamId: "t2",
        wins: 1,
        losses: 1,
        ties: 0,
        pointsFor: 28,
        pointsAgainst: 28,
        divisionWins: 1,
        divisionLosses: 1,
        divisionTies: 0,
        headToHeadJson: serializeHeadToHead({ t1: { w: 0, l: 1, t: 0 } }),
      },
    ]);

    const ranked = rankTeamStats(stats);
    expect(ranked.map((r) => r.teamId)).toEqual(["t1", "t2"]);
  });
});

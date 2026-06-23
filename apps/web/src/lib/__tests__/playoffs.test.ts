import { describe, it, expect } from "vitest";
import {
  roundLabel,
  groupMatchupsByRound,
  winnerSide,
} from "../playoffs";
import type { PlayoffMatchupDto } from "@/lib/data-api";

function m(partial: Partial<PlayoffMatchupDto>): PlayoffMatchupDto {
  return {
    id: "m",
    round: 1,
    slot: 0,
    homeSeed: null,
    awaySeed: null,
    homeTeamId: null,
    awayTeamId: null,
    homeTeamName: null,
    awayTeamName: null,
    winnerTeamId: null,
    fixtureId: null,
    status: null,
    homeScore: null,
    awayScore: null,
    ...partial,
  };
}

describe("roundLabel (WSM-000165)", () => {
  it("names rounds from the end for a size-16 bracket (4 rounds)", () => {
    expect(roundLabel(4, 4)).toBe("Final");
    expect(roundLabel(3, 4)).toBe("Semifinals");
    expect(roundLabel(2, 4)).toBe("Quarterfinals");
    expect(roundLabel(1, 4)).toBe("Round of 16");
  });
  it("uses Final/Semifinals for a size-4 bracket (2 rounds)", () => {
    expect(roundLabel(2, 2)).toBe("Final");
    expect(roundLabel(1, 2)).toBe("Semifinals");
  });
  it("falls back to Round N beyond the named rounds", () => {
    expect(roundLabel(1, 5)).toBe("Round 1"); // 32-team first round
  });
});

describe("groupMatchupsByRound", () => {
  it("groups into ordered rounds, each sorted by slot, with labels", () => {
    const matchups = [
      m({ id: "f", round: 2, slot: 0 }),
      m({ id: "s1", round: 1, slot: 1 }),
      m({ id: "s0", round: 1, slot: 0 }),
    ];
    const rounds = groupMatchupsByRound(matchups, 2);
    expect(rounds.map((r) => r.label)).toEqual(["Semifinals", "Final"]);
    expect(rounds[0].matchups.map((x) => x.id)).toEqual(["s0", "s1"]);
    expect(rounds[1].matchups.map((x) => x.id)).toEqual(["f"]);
  });
});

describe("winnerSide", () => {
  it("returns the side matching winnerTeamId, else null", () => {
    expect(winnerSide(m({ winnerTeamId: null }))).toBeNull();
    expect(
      winnerSide(m({ winnerTeamId: "t1", homeTeamId: "t1", awayTeamId: "t2" })),
    ).toBe("home");
    expect(
      winnerSide(m({ winnerTeamId: "t2", homeTeamId: "t1", awayTeamId: "t2" })),
    ).toBe("away");
  });
});

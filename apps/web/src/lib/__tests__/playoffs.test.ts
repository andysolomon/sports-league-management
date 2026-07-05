import { describe, it, expect } from "vitest";
import {
  roundLabel,
  groupMatchupsByRound,
  winnerSide,
  bracketSections,
  deriveChampion,
  regularSeasonProgress,
  playoffPagePhase,
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
    bracketType: null,
    isBye: false,
    hasPlayLog: false,
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

describe("bracketSections (WSM-flex-brackets)", () => {
  it("single-elim → one untitled winners section using named rounds", () => {
    const matchups = [
      m({ id: "s0", round: 1, slot: 0 }),
      m({ id: "s1", round: 1, slot: 1 }),
      m({ id: "f", round: 2, slot: 0 }),
    ];
    const sections = bracketSections(matchups, 2, "single");
    expect(sections).toHaveLength(1);
    expect(sections[0].type).toBe("winners");
    expect(sections[0].title).toBe("");
    expect(sections[0].rounds.map((r) => r.label)).toEqual([
      "Semifinals",
      "Final",
    ]);
  });

  it("double-elim → winners, losers, and grand-final sections", () => {
    const matchups = [
      m({ id: "w0", round: 1, slot: 0, bracketType: "winners" }),
      m({ id: "w1", round: 1, slot: 1, bracketType: "winners" }),
      m({ id: "wf", round: 2, slot: 0, bracketType: "winners" }),
      m({ id: "l1", round: 1, slot: 0, bracketType: "losers" }),
      m({ id: "l2", round: 2, slot: 0, bracketType: "losers" }),
      m({ id: "gf", round: 1, slot: 0, bracketType: "grandFinal" }),
    ];
    const sections = bracketSections(matchups, 2, "double");
    expect(sections.map((s) => s.type)).toEqual([
      "winners",
      "losers",
      "grandFinal",
    ]);
    expect(sections[0].title).toBe("Winners Bracket");
    expect(sections[1].title).toBe("Losers Bracket");
    // Losers final is the last LB round.
    const lbLabels = sections[1].rounds.map((r) => r.label);
    expect(lbLabels[lbLabels.length - 1]).toBe("Losers Final");
    expect(sections[2].rounds[0].matchups.map((x) => x.id)).toEqual(["gf"]);
  });

  it("omits losers/grand-final sections when those matchups are absent", () => {
    const matchups = [m({ id: "w0", round: 1, slot: 0, bracketType: "winners" })];
    const sections = bracketSections(matchups, 1, "double");
    expect(sections.map((s) => s.type)).toEqual(["winners"]);
  });
});

describe("deriveChampion", () => {
  it("returns the winner of the highest winners-bracket round in single elim", () => {
    const matchups = [
      m({ id: "s0", round: 1, slot: 0, homeTeamId: "t1", homeTeamName: "A" }),
      m({
        id: "f",
        round: 2,
        slot: 0,
        homeTeamId: "t1",
        homeTeamName: "A",
        awayTeamId: "t2",
        awayTeamName: "B",
        winnerTeamId: "t2",
      }),
    ];
    expect(deriveChampion(matchups, "single")).toEqual({
      teamId: "t2",
      teamName: "B",
    });
  });

  it("returns null until the final has a winner", () => {
    const matchups = [
      m({ id: "f", round: 2, slot: 0, homeTeamId: "t1", awayTeamId: "t2" }),
    ];
    expect(deriveChampion(matchups, "single")).toBeNull();
  });

  it("uses the grand final in double elim", () => {
    const matchups = [
      m({ id: "wf", round: 2, bracketType: "winners", winnerTeamId: "t1" }),
      m({
        id: "gf",
        round: 1,
        bracketType: "grandFinal",
        homeTeamId: "t1",
        homeTeamName: "A",
        awayTeamId: "t2",
        awayTeamName: "B",
        winnerTeamId: "t1",
      }),
    ];
    expect(deriveChampion(matchups, "double")).toEqual({
      teamId: "t1",
      teamName: "A",
    });
  });
});

describe("regularSeasonProgress", () => {
  it("counts only non-playoff fixtures", () => {
    const progress = regularSeasonProgress([
      { stage: "regular", status: "final" },
      { stage: "regular", status: "scheduled" },
      { stage: "playoff", status: "final" },
    ]);
    expect(progress).toEqual({ total: 2, final: 1, complete: false });
  });

  it("marks complete when every regular game is final", () => {
    const progress = regularSeasonProgress([
      { stage: "regular", status: "final" },
      { stage: "regular", status: "cancelled" },
    ]);
    expect(progress.complete).toBe(true);
  });
});

describe("playoffPagePhase", () => {
  it("returns bracket_live when a bracket exists", () => {
    expect(
      playoffPagePhase({
        playoffTeams: 8,
        bracketExists: true,
        regularComplete: false,
      }),
    ).toBe("bracket_live");
  });

  it("returns ready when the regular season is complete and no bracket", () => {
    expect(
      playoffPagePhase({
        playoffTeams: 8,
        bracketExists: false,
        regularComplete: true,
      }),
    ).toBe("ready");
  });

  it("returns in_progress when games remain", () => {
    expect(
      playoffPagePhase({
        playoffTeams: 8,
        bracketExists: false,
        regularComplete: false,
      }),
    ).toBe("in_progress");
  });
});

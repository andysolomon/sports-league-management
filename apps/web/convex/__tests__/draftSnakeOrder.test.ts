import { describe, it, expect } from "vitest";
import { pickRound, teamOnClock } from "../lib/draft";

const ORDER = ["t1", "t2", "t3", "t4"];

describe("pickRound", () => {
  it("maps pick numbers to rounds for four teams", () => {
    expect(pickRound(1, 4)).toBe(1);
    expect(pickRound(4, 4)).toBe(1);
    expect(pickRound(5, 4)).toBe(2);
    expect(pickRound(8, 4)).toBe(2);
    expect(pickRound(9, 4)).toBe(3);
  });
});

describe("teamOnClock", () => {
  it("uses forward order in odd rounds", () => {
    expect(teamOnClock(ORDER, 1, 3)).toBe("t1");
    expect(teamOnClock(ORDER, 2, 3)).toBe("t2");
    expect(teamOnClock(ORDER, 4, 3)).toBe("t4");
  });

  it("uses reverse order in even rounds", () => {
    expect(teamOnClock(ORDER, 5, 3)).toBe("t4");
    expect(teamOnClock(ORDER, 6, 3)).toBe("t3");
    expect(teamOnClock(ORDER, 8, 3)).toBe("t1");
  });

  it("returns null past the final pick", () => {
    expect(teamOnClock(ORDER, 12, 3)).toBe("t4");
    expect(teamOnClock(ORDER, 13, 3)).toBeNull();
    expect(teamOnClock(ORDER, 0, 3)).toBeNull();
  });

  it("handles two-team boundaries", () => {
    const two = ["a", "b"];
    expect(teamOnClock(two, 1, 2)).toBe("a");
    expect(teamOnClock(two, 2, 2)).toBe("b");
    expect(teamOnClock(two, 3, 2)).toBe("b");
    expect(teamOnClock(two, 4, 2)).toBe("a");
    expect(teamOnClock(two, 5, 2)).toBeNull();
  });
});

import { describe, it, expect } from "vitest";
import {
  applyScore,
  isValidPoints,
  isNonNegInt,
  isLiveStatus,
} from "../lib/liveScore";

describe("isValidPoints", () => {
  it("accepts football scoring values, rejects the rest", () => {
    for (const p of [1, 2, 3, 6, 7, 8]) expect(isValidPoints(p)).toBe(true);
    for (const p of [0, 4, 5, -6, 2.5]) expect(isValidPoints(p)).toBe(false);
  });
});

describe("isNonNegInt", () => {
  it("accepts non-negative integers only", () => {
    expect(isNonNegInt(0)).toBe(true);
    expect(isNonNegInt(21)).toBe(true);
    expect(isNonNegInt(-1)).toBe(false);
    expect(isNonNegInt(3.5)).toBe(false);
  });
});

describe("isLiveStatus", () => {
  it("recognizes the live statuses", () => {
    expect(isLiveStatus("in_progress")).toBe(true);
    expect(isLiveStatus("halftime")).toBe(true);
    expect(isLiveStatus("final")).toBe(true);
    expect(isLiveStatus("scheduled")).toBe(false);
    expect(isLiveStatus("")).toBe(false);
  });
});

describe("applyScore", () => {
  it("adds points to the scoring side", () => {
    expect(applyScore({ homeScore: 7, awayScore: 3 }, "home", 6)).toEqual({
      homeScore: 13,
      awayScore: 3,
    });
    expect(applyScore({ homeScore: 7, awayScore: 3 }, "away", 3)).toEqual({
      homeScore: 7,
      awayScore: 6,
    });
  });

  it("throws on an invalid point value", () => {
    expect(() => applyScore({ homeScore: 0, awayScore: 0 }, "home", 4)).toThrow(
      /invalid_points/,
    );
  });

  it("throws on an unknown team", () => {
    // @ts-expect-error exercising the runtime guard with a bad team
    expect(() => applyScore({ homeScore: 0, awayScore: 0 }, "neither", 6)).toThrow(
      /invalid_team/,
    );
  });
});

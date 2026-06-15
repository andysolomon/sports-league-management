import { describe, it, expect } from "vitest";
import {
  fraction,
  percent,
  gaugeDash,
  sparklinePoints,
  heatLevel,
} from "../bento";

describe("fraction / percent", () => {
  it("clamps to 0..1 and handles max ≤ 0", () => {
    expect(fraction(5, 10)).toBe(0.5);
    expect(fraction(20, 10)).toBe(1);
    expect(fraction(-5, 10)).toBe(0);
    expect(fraction(5, 0)).toBe(0);
  });
  it("rounds to whole percent", () => {
    expect(percent(1, 3)).toBe(33);
    expect(percent(2, 3)).toBe(67);
  });
});

describe("gaugeDash", () => {
  it("splits the circumference by fraction", () => {
    expect(gaugeDash(0.25, 100)).toEqual({ dash: 25, gap: 75 });
    expect(gaugeDash(0, 100)).toEqual({ dash: 0, gap: 100 });
    expect(gaugeDash(2, 100)).toEqual({ dash: 100, gap: 0 }); // clamped
  });
});

describe("sparklinePoints", () => {
  it("returns empty for no values", () => {
    expect(sparklinePoints([], 100, 40)).toBe("");
  });
  it("spans the width for a single value", () => {
    expect(sparklinePoints([5], 100, 40, 2)).toBe("2,20 98,20");
  });
  it("maps endpoints to the box corners for a rising series", () => {
    const pts = sparklinePoints([0, 10], 100, 40, 2).split(" ");
    expect(pts).toHaveLength(2);
    // first point at left/bottom, last at right/top (y inverted)
    expect(pts[0]).toBe("2,38");
    expect(pts[1]).toBe("98,2");
  });
  it("flat series renders mid-height", () => {
    const pts = sparklinePoints([4, 4, 4], 100, 40, 0);
    expect(pts).toBe("0,20 50,20 100,20");
  });
});

describe("heatLevel", () => {
  it("buckets counts into 0..4", () => {
    expect(heatLevel(0, 10)).toBe(0);
    expect(heatLevel(1, 10)).toBe(1);
    expect(heatLevel(3, 10)).toBe(2);
    expect(heatLevel(6, 10)).toBe(3);
    expect(heatLevel(10, 10)).toBe(4);
    expect(heatLevel(5, 0)).toBe(0);
  });
});

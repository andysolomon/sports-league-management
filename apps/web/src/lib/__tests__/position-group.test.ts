import { describe, it, expect } from "vitest";
import { derivePositionGroup } from "../position-group";

describe("derivePositionGroup", () => {
  const cases: Array<[string, ReturnType<typeof derivePositionGroup>]> = [
    ["QB", "QB"],
    ["HB", "RB"],
    ["FB", "RB"],
    ["WR", "WR"],
    ["TE", "TE"],
    ["LT", "OL"],
    ["LG", "OL"],
    ["C", "OL"],
    ["RG", "OL"],
    ["RT", "OL"],
    ["DE", "DL"],
    ["DT", "DL"],
    ["NT", "DL"],
    ["OLB", "LB"],
    ["MLB", "LB"],
    ["ILB", "LB"],
    ["CB", "DB"],
    ["S", "DB"],
    ["FS", "DB"],
    ["SS", "DB"],
    ["NB", "DB"],
    ["K", "K/P"],
    ["P", "K/P"],
    ["LS", "K/P"],
  ];

  it.each(cases)("maps %s → %s", (position, expected) => {
    expect(derivePositionGroup(position)).toBe(expected);
  });

  it("returns null for an unknown position", () => {
    expect(derivePositionGroup("XYZ")).toBeNull();
  });

  it("is case-insensitive and trims whitespace", () => {
    expect(derivePositionGroup("  qb  ")).toBe("QB");
    expect(derivePositionGroup("olb")).toBe("LB");
  });

  it("returns null for an empty string", () => {
    expect(derivePositionGroup("")).toBeNull();
  });
});

import { describe, it, expect } from "vitest";
import { abbreviateName, derivePositionGroup, groupPlayersByPosition } from "../position-group";

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

describe("groupPlayersByPosition (WSM-000086)", () => {
  const p = (name: string, position: string, jerseyNumber: number | null = null) => ({
    name,
    position,
    jerseyNumber,
  });

  it("orders groups in canonical football order and omits empty groups", () => {
    const grouped = groupPlayersByPosition([
      p("Corner", "CB"),
      p("Passer", "QB"),
      p("Tackle", "LT"),
    ]);
    expect(grouped.map((g) => g.group)).toEqual(["QB", "OL", "DB"]);
  });

  it("maps common ESPN abbreviations (RB, G, OT) instead of dropping them", () => {
    expect(derivePositionGroup("RB")).toBe("RB");
    expect(derivePositionGroup("G")).toBe("OL");
    expect(derivePositionGroup("OT")).toBe("OL");
  });

  it("buckets unknown positions into a trailing Other group", () => {
    const grouped = groupPlayersByPosition([p("Mystery", "XYZ"), p("Passer", "QB")]);
    expect(grouped.map((g) => g.group)).toEqual(["QB", "Other"]);
    expect(grouped[1].players[0].name).toBe("Mystery");
  });

  it("sorts within a group by position order, then jersey, then name", () => {
    const grouped = groupPlayersByPosition([
      p("Right Tackle", "RT", 71),
      p("Center Two", "C", 60),
      p("Center One", "C", 52),
      p("Left Tackle", "LT", 78),
      p("No Jersey Center", "C"),
    ]);
    expect(grouped[0].group).toBe("OL");
    expect(grouped[0].players.map((x) => x.name)).toEqual([
      "Left Tackle",
      "Center One",
      "Center Two",
      "No Jersey Center",
      "Right Tackle",
    ]);
  });

  it("reads the offensive line left to right", () => {
    const grouped = groupPlayersByPosition([
      p("RG", "RG", 1),
      p("C", "C", 1),
      p("LT", "LT", 1),
      p("RT", "RT", 1),
      p("LG", "LG", 1),
    ]);
    expect(grouped[0].players.map((x) => x.position)).toEqual([
      "LT",
      "LG",
      "C",
      "RG",
      "RT",
    ]);
  });
});

describe("abbreviateName (WSM-000088)", () => {
  it("abbreviates first name to an initial", () => {
    expect(abbreviateName("Adam Thielen")).toBe("A. Thielen");
  });

  it("keeps multi-part last names", () => {
    expect(abbreviateName("Terrace Marshall Jr")).toBe("T. Marshall Jr");
  });

  it("passes single-word names through", () => {
    expect(abbreviateName("Neymar")).toBe("Neymar");
  });

  it("trims and collapses whitespace", () => {
    expect(abbreviateName("  Bam   Knight  ")).toBe("B. Knight");
  });
});

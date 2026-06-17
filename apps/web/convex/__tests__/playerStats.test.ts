import { describe, it, expect } from "vitest";
import { aggregateStatLines, parseStatLine } from "../lib/playerStats";

describe("aggregateStatLines", () => {
  it("sums fields across games, group by group", () => {
    const totals = aggregateStatLines([
      { passing: { comp: 18, att: 27, yards: 243, td: 3, int: 1 } },
      { passing: { comp: 20, att: 30, yards: 310, td: 2, int: 0 } },
    ]);
    expect(totals.passing).toEqual({
      comp: 38,
      att: 57,
      yards: 553,
      td: 5,
      int: 1,
    });
  });

  it("takes MAX for `long` fields, SUM for the rest", () => {
    const totals = aggregateStatLines([
      { rushing: { carries: 12, yards: 88, td: 1, long: 22 } },
      { rushing: { carries: 9, yards: 140, td: 2, long: 61 } },
    ]);
    expect(totals.rushing).toEqual({ carries: 21, yards: 228, td: 3, long: 61 });
  });

  it("merges disjoint groups and ignores non-numeric values", () => {
    const totals = aggregateStatLines([
      { rushing: { carries: 5, yards: 30 } },
      { receiving: { rec: 4, yards: 51 } },
      // @ts-expect-error intentionally malformed value is ignored
      { rushing: { carries: "x", yards: 12 } },
    ]);
    expect(totals.rushing).toEqual({ carries: 5, yards: 42 });
    expect(totals.receiving).toEqual({ rec: 4, yards: 51 });
  });

  it("returns {} for no games", () => {
    expect(aggregateStatLines([])).toEqual({});
  });
});

describe("parseStatLine", () => {
  it("parses valid json", () => {
    expect(parseStatLine('{"passing":{"td":2}}')).toEqual({
      passing: { td: 2 },
    });
  });

  it("returns {} for bad or non-object json", () => {
    expect(parseStatLine("not json")).toEqual({});
    expect(parseStatLine("42")).toEqual({});
    expect(parseStatLine("")).toEqual({});
  });
});

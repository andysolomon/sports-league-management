import { describe, it, expect } from "vitest";
import {
  mapStatLineToMaxPreps,
  generateMaxPrepsTxt,
} from "../maxpreps-export";

describe("mapStatLineToMaxPreps", () => {
  it("maps our fields to the verbatim MaxPreps names", () => {
    const m = mapStatLineToMaxPreps({
      passing: { comp: 18, att: 27, yards: 243, td: 3, int: 1 },
      rushing: { carries: 5, yards: 30, long: 12, td: 1 },
      defense: { tacklesSolo: 5, tacklesAst: 2, sacks: 1 },
    });
    expect(m).toMatchObject({
      PassingComp: 18,
      PassingAtt: 27,
      PassingYards: 243,
      PassingTD: 3,
      PassingInt: 1,
      RushingNum: 5,
      RushingYards: 30,
      RushingLong: 12,
      RushingTDNum: 1,
      Tackles: 5,
      Assists: 2,
      Sacks: 1,
    });
  });

  it("omits our fields with no MaxPreps Football target", () => {
    const m = mapStatLineToMaxPreps({
      passing: { sacked: 3 },
      receiving: { rec: 4, targets: 7 },
      defense: { defTd: 1 },
    });
    expect(m).toEqual({ ReceivingNum: 4 }); // sacked, targets, defTd dropped
  });
});

describe("generateMaxPrepsTxt", () => {
  const rows = [
    { jersey: 12, stats: { passing: { comp: 18, att: 27, yards: 243, td: 3 } } },
    { jersey: 5, stats: { rushing: { carries: 14, yards: 92, td: 2 } } },
  ];

  it("writes supplier id, Jersey-first header, and one row per player", () => {
    const { text, rowCount } = generateMaxPrepsTxt("SUPPLIER-123", rows);
    const lines = text.split("\n");
    expect(lines[0]).toBe("SUPPLIER-123");
    expect(lines[1].startsWith("Jersey|")).toBe(true);
    expect(rowCount).toBe(2);
    expect(lines).toHaveLength(4); // supplier + header + 2 players
  });

  it("includes only columns some player has, with blanks for gaps", () => {
    const { text } = generateMaxPrepsTxt("SID", rows);
    const [, header, row12, row5] = text.split("\n");
    const cols = header.split("|");
    // QB-only and RB-only columns both present
    expect(cols).toContain("PassingComp");
    expect(cols).toContain("RushingNum");
    // Player 12 (passing) has a blank in the RushingNum column
    const rushIdx = cols.indexOf("RushingNum");
    expect(row12.split("|")[rushIdx]).toBe("");
    expect(row5.split("|")[rushIdx]).toBe("14");
  });

  it("skips players with no mappable stats", () => {
    const { text, rowCount } = generateMaxPrepsTxt("SID", [
      { jersey: 99, stats: {} },
      { jersey: 7, stats: { rushing: { carries: 3 } } },
    ]);
    expect(rowCount).toBe(1);
    expect(text.split("\n")).toHaveLength(3); // supplier + header + 1 player
  });
});

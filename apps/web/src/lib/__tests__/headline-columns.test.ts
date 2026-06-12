import { describe, it, expect } from "vitest";
import {
  lookupAttribute,
  presentHeadlineKeys,
  type PlayerSnapshot,
} from "../attributes/headline-columns";

const snap = (
  attributes: Record<string, number>,
  weightedOverall: number | null = 80,
): PlayerSnapshot => ({ weightedOverall, attributes });

describe("lookupAttribute (WSM-000090)", () => {
  it("matches keys case-insensitively", () => {
    expect(lookupAttribute(snap({ spd: 91 }), "SPD")).toBe(91);
    expect(lookupAttribute(snap({ Speed: 91 }), "speed")).toBe(91);
  });

  it("returns null for missing snapshot or key", () => {
    expect(lookupAttribute(undefined, "SPD")).toBeNull();
    expect(lookupAttribute(snap({ STR: 70 }), "SPD")).toBeNull();
  });
});

describe("presentHeadlineKeys (WSM-000090)", () => {
  it("includes only keys at least one player has", () => {
    const snapshots = new Map<string, PlayerSnapshot>([
      ["p1", snap({ SPD: 90, AWR: 75 })],
      ["p2", snap({ STR: 88 })],
    ]);
    expect(presentHeadlineKeys(snapshots, ["p1", "p2"])).toEqual([
      "SPD",
      "STR",
      "AWR",
    ]);
  });

  it("ignores snapshots for players outside the visible set", () => {
    const snapshots = new Map<string, PlayerSnapshot>([
      ["hidden", snap({ AGI: 99 })],
    ]);
    expect(presentHeadlineKeys(snapshots, ["p1"])).toEqual([]);
  });

  it("returns empty for no snapshots — no empty stat columns", () => {
    expect(presentHeadlineKeys(new Map(), ["p1", "p2"])).toEqual([]);
  });
});

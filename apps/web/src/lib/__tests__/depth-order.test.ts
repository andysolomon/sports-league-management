import { describe, it, expect } from "vitest";
import type { PlayerDto } from "@sports-management/shared-types";
import { orderByDepth } from "../roster/depth-order";

// Minimal player factory — only the fields orderByDepth reads.
function player(
  id: string,
  jerseyNumber: number | null,
): PlayerDto {
  return { id, jerseyNumber } as PlayerDto;
}

describe("orderByDepth (WSM-000088 follow-up)", () => {
  it("puts the highest-OVR player in slot 1 regardless of jersey number", () => {
    // The reported bug: Josh Allen (#17, OVR 84) sat in slot 3 behind unrated
    // backups with lower jersey numbers.
    const ovr: Record<string, number | null> = {
      buechele: null,
      kAllen: null,
      jAllen: 84,
    };
    const group = [
      player("buechele", 6),
      player("kAllen", 11),
      player("jAllen", 17),
    ];
    const ordered = orderByDepth(group, (p) => ovr[p.id]);
    expect(ordered.map((p) => p.id)).toEqual(["jAllen", "buechele", "kAllen"]);
  });

  it("sorts multiple rated players by OVR descending", () => {
    const ovr: Record<string, number> = { a: 70, b: 92, c: 81 };
    const group = [player("a", 1), player("b", 2), player("c", 3)];
    const ordered = orderByDepth(group, (p) => ovr[p.id]);
    expect(ordered.map((p) => p.id)).toEqual(["b", "c", "a"]);
  });

  it("ranks unrated players after rated ones", () => {
    const ovr: Record<string, number | null> = { rated: 60, unrated: null };
    const group = [player("unrated", 1), player("rated", 99)];
    const ordered = orderByDepth(group, (p) => ovr[p.id]);
    expect(ordered.map((p) => p.id)).toEqual(["rated", "unrated"]);
  });

  it("breaks ties (all unrated) by ascending jersey number", () => {
    const group = [player("c", 17), player("a", 6), player("b", 11)];
    const ordered = orderByDepth(group, () => null);
    expect(ordered.map((p) => p.id)).toEqual(["a", "b", "c"]);
  });

  it("does not mutate the input array", () => {
    const group = [player("a", 2), player("b", 1)];
    const snapshot = [...group];
    orderByDepth(group, () => null);
    expect(group).toEqual(snapshot);
  });
});

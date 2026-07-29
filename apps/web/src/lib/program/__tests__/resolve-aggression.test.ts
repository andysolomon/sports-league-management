import { describe, expect, it } from "vitest";
import { resolveAggression } from "@/lib/program/resolveProgram";

describe("resolveAggression", () => {
  it("prefers coach aggression over the team program row", () => {
    expect(resolveAggression(88, 40)).toBe(88);
    expect(resolveAggression(null, 40)).toBe(40);
    expect(resolveAggression(undefined, undefined)).toBeUndefined();
  });
});

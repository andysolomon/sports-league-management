import { describe, it, expect } from "vitest";
import { normalizePff } from "../pff";

describe("normalizePff", () => {
  it("returns canonical shape for a valid payload", () => {
    expect(
      normalizePff({
        playerId: "p_1",
        positionGroup: "QB",
        attributes: { armStrength: 92, accuracy: 88 },
      }),
    ).toEqual({
      positionGroup: "QB",
      attributes: { armStrength: 92, accuracy: 88 },
    });
  });

  it("drops non-numeric attribute values", () => {
    const result = normalizePff({
      positionGroup: "QB",
      attributes: { armStrength: 92, raw: "n/a", weirdNan: NaN, ok: 70 },
    });
    expect(result?.attributes).toEqual({ armStrength: 92, ok: 70 });
  });

  it("returns null when positionGroup is missing", () => {
    expect(
      normalizePff({ attributes: { armStrength: 92 } }),
    ).toBeNull();
  });

  it("returns null when positionGroup is unknown", () => {
    expect(
      normalizePff({
        positionGroup: "WIZARD",
        attributes: { armStrength: 92 },
      }),
    ).toBeNull();
  });

  it("returns null when attributes object is missing", () => {
    expect(normalizePff({ positionGroup: "QB" })).toBeNull();
  });

  it("returns null when attributes object yields no numeric entries", () => {
    expect(
      normalizePff({ positionGroup: "QB", attributes: { x: "y" } }),
    ).toBeNull();
  });

  it("returns null for non-object input", () => {
    expect(normalizePff(null)).toBeNull();
    expect(normalizePff("string")).toBeNull();
    expect(normalizePff(42)).toBeNull();
  });
});

import { describe, it, expect } from "vitest";
import { normalizeAdminJson } from "../admin-json";

describe("normalizeAdminJson", () => {
  it("passes a valid canonical payload through", () => {
    expect(
      normalizeAdminJson({
        playerId: "p_1",
        positionGroup: "WR",
        attributes: { speed: 95, separation: 88 },
      }),
    ).toEqual({
      positionGroup: "WR",
      attributes: { speed: 95, separation: 88 },
    });
  });

  it("drops non-numeric attribute values", () => {
    const result = normalizeAdminJson({
      positionGroup: "QB",
      attributes: { armStrength: 90, comment: "great", clutch: 80 },
    });
    expect(result?.attributes).toEqual({ armStrength: 90, clutch: 80 });
  });

  it("returns null when positionGroup is invalid", () => {
    expect(
      normalizeAdminJson({
        positionGroup: "QUARTERBACK",
        attributes: { speed: 90 },
      }),
    ).toBeNull();
  });

  it("returns null when attributes object is missing or empty", () => {
    expect(normalizeAdminJson({ positionGroup: "QB" })).toBeNull();
    expect(
      normalizeAdminJson({ positionGroup: "QB", attributes: {} }),
    ).toBeNull();
  });
});

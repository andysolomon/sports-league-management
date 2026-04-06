import { describe, it, expect } from "vitest";
import { enforceTierLimit, requireFeature } from "../tier-enforcement";
import { ApiError } from "../api-error";

describe("enforceTierLimit", () => {
  it("free tier allows up to 1 team", () => {
    expect(() => enforceTierLimit("free", "teams", 0)).not.toThrow();
  });

  it("free tier blocks creating a 2nd team", () => {
    expect(() => enforceTierLimit("free", "teams", 1)).toThrowError(ApiError);
    try {
      enforceTierLimit("free", "teams", 1);
    } catch (err) {
      expect((err as ApiError).statusCode).toBe(403);
      expect((err as ApiError).userMessage).toContain("Free plan is limited");
      expect((err as ApiError).userMessage).toContain("Plus");
    }
  });

  it("plus tier allows unlimited teams", () => {
    expect(() => enforceTierLimit("plus", "teams", 100)).not.toThrow();
    expect(() => enforceTierLimit("plus", "teams", 1000)).not.toThrow();
  });

  it("club tier allows unlimited teams", () => {
    expect(() => enforceTierLimit("club", "teams", 50)).not.toThrow();
  });

  it("league tier allows unlimited teams", () => {
    expect(() => enforceTierLimit("league", "teams", 9999)).not.toThrow();
  });

  it("free tier allows unlimited players per team", () => {
    expect(() => enforceTierLimit("free", "playersPerTeam", 1000)).not.toThrow();
  });
});

describe("requireFeature", () => {
  it("free tier blocks paymentCollection feature", () => {
    expect(() => requireFeature("free", "paymentCollection")).toThrowError(
      ApiError,
    );
  });

  it("plus tier allows paymentCollection feature", () => {
    expect(() => requireFeature("plus", "paymentCollection")).not.toThrow();
  });

  it("free tier blocks analytics", () => {
    try {
      requireFeature("free", "analytics");
    } catch (err) {
      expect((err as ApiError).statusCode).toBe(403);
      expect((err as ApiError).userMessage).toContain("Club");
    }
  });

  it("club tier unlocks analytics", () => {
    expect(() => requireFeature("club", "analytics")).not.toThrow();
  });

  it("league tier unlocks API access", () => {
    expect(() => requireFeature("league", "apiAccess")).not.toThrow();
  });

  it("plus tier blocks API access", () => {
    expect(() => requireFeature("plus", "apiAccess")).toThrowError(ApiError);
  });
});

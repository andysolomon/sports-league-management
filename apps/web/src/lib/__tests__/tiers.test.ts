import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock env vars before importing the module
beforeEach(() => {
  vi.resetModules();
  process.env.STRIPE_PRICE_PLUS_MONTHLY = "price_plus_monthly";
  process.env.STRIPE_PRICE_PLUS_YEARLY = "price_plus_yearly";
  process.env.STRIPE_PRICE_CLUB_MONTHLY = "price_club_monthly";
  process.env.STRIPE_PRICE_CLUB_YEARLY = "price_club_yearly";
  process.env.STRIPE_PRICE_LEAGUE_MONTHLY = "price_league_monthly";
  process.env.STRIPE_PRICE_LEAGUE_YEARLY = "price_league_yearly";
});

describe("tiers", () => {
  it("getTierFromPriceId resolves Plus monthly", async () => {
    const { getTierFromPriceId } = await import("../tiers");
    expect(getTierFromPriceId("price_plus_monthly")).toBe("plus");
  });

  it("getTierFromPriceId resolves Plus yearly", async () => {
    const { getTierFromPriceId } = await import("../tiers");
    expect(getTierFromPriceId("price_plus_yearly")).toBe("plus");
  });

  it("getTierFromPriceId resolves Club", async () => {
    const { getTierFromPriceId } = await import("../tiers");
    expect(getTierFromPriceId("price_club_monthly")).toBe("club");
  });

  it("getTierFromPriceId resolves League", async () => {
    const { getTierFromPriceId } = await import("../tiers");
    expect(getTierFromPriceId("price_league_yearly")).toBe("league");
  });

  it("getTierFromPriceId returns null for unknown price", async () => {
    const { getTierFromPriceId } = await import("../tiers");
    expect(getTierFromPriceId("price_unknown")).toBeNull();
  });

  it("tierMeetsRequirement: free does not meet plus", async () => {
    const { tierMeetsRequirement } = await import("../tiers");
    expect(tierMeetsRequirement("free", "plus")).toBe(false);
  });

  it("tierMeetsRequirement: plus meets plus", async () => {
    const { tierMeetsRequirement } = await import("../tiers");
    expect(tierMeetsRequirement("plus", "plus")).toBe(true);
  });

  it("tierMeetsRequirement: club meets plus", async () => {
    const { tierMeetsRequirement } = await import("../tiers");
    expect(tierMeetsRequirement("club", "plus")).toBe(true);
  });

  it("tierMeetsRequirement: league meets all", async () => {
    const { tierMeetsRequirement } = await import("../tiers");
    expect(tierMeetsRequirement("league", "free")).toBe(true);
    expect(tierMeetsRequirement("league", "plus")).toBe(true);
    expect(tierMeetsRequirement("league", "club")).toBe(true);
    expect(tierMeetsRequirement("league", "league")).toBe(true);
  });

  it("isPaidTier: free is not paid", async () => {
    const { isPaidTier } = await import("../tiers");
    expect(isPaidTier("free")).toBe(false);
  });

  it("isPaidTier: plus, club, league are paid", async () => {
    const { isPaidTier } = await import("../tiers");
    expect(isPaidTier("plus")).toBe(true);
    expect(isPaidTier("club")).toBe(true);
    expect(isPaidTier("league")).toBe(true);
  });

  it("free tier has 1 team limit", async () => {
    const { getTierLimits } = await import("../tiers");
    expect(getTierLimits("free").maxTeams).toBe(1);
  });

  it("plus tier has unlimited teams", async () => {
    const { getTierLimits } = await import("../tiers");
    expect(getTierLimits("plus").maxTeams).toBe(-1);
  });
});

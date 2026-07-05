import { describe, it, expect } from "vitest";
import {
  validatePlayerAttributeEdit,
  computeRatingOverall,
} from "../known-keys";

describe("validatePlayerAttributeEdit", () => {
  it("accepts Madden-style keys in 0–99", () => {
    const res = validatePlayerAttributeEdit({ SPD: 80, STR: 75 });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.normalized.SPD).toBe(80);
    expect(res.normalized.OVR).toBe(78);
    expect(res.weightedOverall).toBe(78);
  });

  it("rejects out-of-range values", () => {
    const res = validatePlayerAttributeEdit({ AGI: 100 });
    expect(res).toEqual({ ok: false, error: "attribute_out_of_range:AGI" });
  });
});

describe("computeRatingOverall", () => {
  it("uses explicit OVR when present", () => {
    expect(computeRatingOverall({ efficiency: 70, OVR: 88 })).toBe(88);
  });

  it("averages components when OVR absent", () => {
    expect(computeRatingOverall({ efficiency: 80, production: 60 })).toBe(70);
  });
});

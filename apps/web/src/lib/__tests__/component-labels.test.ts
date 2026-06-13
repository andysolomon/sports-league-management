import { describe, it, expect } from "vitest";
import { componentLabel, orderedComponents } from "../ratings/component-labels";

describe("componentLabel (WSM-000093)", () => {
  it("maps known keys to friendly labels", () => {
    expect(componentLabel("rushEff")).toBe("Rush Efficiency");
    expect(componentLabel("ballHawk")).toBe("Ball Hawk");
    expect(componentLabel("efficiency")).toBe("Efficiency");
  });

  it("falls back to a split, title-cased label for unknown camelCase keys", () => {
    expect(componentLabel("redZoneRate")).toBe("Red Zone Rate");
    expect(componentLabel("snap_share")).toBe("Snap share");
  });
});

describe("orderedComponents (WSM-000093)", () => {
  it("drops OVR and sorts by value descending", () => {
    const out = orderedComponents({ OVR: 90, coverage: 70, tackling: 88, ballHawk: 60 });
    expect(out.map((c) => c.key)).toEqual(["tackling", "coverage", "ballHawk"]);
    expect(out[0].label).toBe("Tackling");
  });

  it("returns empty for an OVR-only map", () => {
    expect(orderedComponents({ OVR: 80 })).toEqual([]);
  });
});

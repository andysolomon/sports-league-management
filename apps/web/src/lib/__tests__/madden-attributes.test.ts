import { describe, it, expect } from "vitest";
import {
  maddenAttributeLabel,
  orderedMaddenAttributes,
} from "../madden/attributes";

describe("maddenAttributeLabel (WSM-000095)", () => {
  it("maps known keys to friendly labels", () => {
    expect(maddenAttributeLabel("THROWACCURACYSHORT")).toBe(
      "Throw Accuracy (Short)",
    );
    expect(maddenAttributeLabel("ZONECOVERAGE")).toBe("Zone Coverage");
    expect(maddenAttributeLabel("SPEED")).toBe("Speed");
  });

  it("falls back to a title-cased label for unknown keys", () => {
    expect(maddenAttributeLabel("NEWTRAIT")).toBe("Newtrait");
  });
});

describe("orderedMaddenAttributes (WSM-000095)", () => {
  it("drops the duplicated OVERALL key and sorts by value descending", () => {
    const out = orderedMaddenAttributes({
      OVERALL: 99,
      SPEED: 88,
      THROWPOWER: 97,
      AWARENESS: 96,
    });
    expect(out.map((a) => a.key)).toEqual([
      "THROWPOWER",
      "AWARENESS",
      "SPEED",
    ]);
    expect(out[0].label).toBe("Throw Power");
  });
});

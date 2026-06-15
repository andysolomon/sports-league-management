import { describe, it, expect } from "vitest";
import { buildBasemap } from "../geo-basemap";

describe("buildBasemap", () => {
  it("produces state outline paths for the US basemap", () => {
    const { statePaths } = buildBasemap([], 320, 200);
    // 50 states + DC + a couple territories from us-atlas; at least the lower 48.
    expect(statePaths.length).toBeGreaterThan(40);
    statePaths.forEach((d) => expect(d.startsWith("M")).toBe(true));
  });

  it("projects only teams with a known city, inside the box", () => {
    const { markers } = buildBasemap(
      [
        { name: "Hawks", city: "Austin" },
        { name: "Bears", city: "Smallville" }, // unknown → dropped
        { name: "Owls", city: "Seattle" },
      ],
      320,
      200,
    );
    expect(markers.map((m) => m.name)).toEqual(["Hawks", "Owls"]);
    for (const m of markers) {
      expect(m.x).toBeGreaterThanOrEqual(0);
      expect(m.x).toBeLessThanOrEqual(320);
      expect(m.y).toBeGreaterThanOrEqual(0);
      expect(m.y).toBeLessThanOrEqual(200);
    }
  });

  it("places western cities left of eastern cities", () => {
    const { markers } = buildBasemap(
      [
        { name: "West", city: "Seattle" },
        { name: "East", city: "Boston" },
      ],
      320,
      200,
    );
    const west = markers.find((m) => m.name === "West")!;
    const east = markers.find((m) => m.name === "East")!;
    expect(west.x).toBeLessThan(east.x);
  });
});

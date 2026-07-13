import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TeamMark } from "../team-mark";

describe("TeamMark", () => {
  it("renders two-letter initials from a multi-word team name", () => {
    const html = renderToStaticMarkup(createElement(TeamMark, { name: "Dallas Cowboys" }));
    expect(html).toContain("DC");
  });

  it("renders initials for a single-word team name", () => {
    const html = renderToStaticMarkup(createElement(TeamMark, { name: "Cowboys" }));
    expect(html).toContain("CO");
  });
});

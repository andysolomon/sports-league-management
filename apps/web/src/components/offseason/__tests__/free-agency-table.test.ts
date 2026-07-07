import { createElement } from "react";
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { FreeAgencyTableView } from "@/components/offseason/FreeAgencyTableView";
import type { FreeAgentRow } from "@/lib/offseason-free-agency";

const AGENTS: FreeAgentRow[] = [
  {
    id: "p1",
    name: "Alex Alpha",
    position: "QB",
    grade: 12,
    overall: 88,
    teamId: "t1",
  },
  {
    id: "p2",
    name: "Ben Beta",
    position: "WR",
    grade: 11,
    overall: null,
    teamId: "t1",
  },
];

describe("FreeAgencyTableView", () => {
  it("renders rows with class labels and overall values", () => {
    const html = renderToStaticMarkup(
      createElement(FreeAgencyTableView, {
        agents: AGENTS,
        canSign: true,
        signLabel: () => "Sign",
      }),
    );
    expect(html).toContain("Alex Alpha");
    expect(html).toContain("Ben Beta");
    expect(html).toContain("SR");
    expect(html).toContain("JR");
    expect(html).toContain("88");
    expect(html).toContain("Sign");
  });

  it("hides sign actions when the user cannot sign", () => {
    const html = renderToStaticMarkup(
      createElement(FreeAgencyTableView, {
        agents: AGENTS,
        canSign: false,
        signLabel: () => "Sign",
      }),
    );
    expect(html).not.toContain("Sign");
  });

  it("renders an empty state when no agents are provided", () => {
    const html = renderToStaticMarkup(
      createElement(FreeAgencyTableView, {
        agents: [],
        canSign: true,
        signLabel: () => "Sign",
      }),
    );
    expect(html).toContain("No free agents match the current filters.");
  });
});

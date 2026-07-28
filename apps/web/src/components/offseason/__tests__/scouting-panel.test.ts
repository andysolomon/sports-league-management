import { createElement } from "react";
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ProspectDto } from "@/lib/data-api";

vi.mock("@/app/dashboard/_actions/recruiting", () => ({
  scoutProspectAction: vi.fn(),
  signProspectAction: vi.fn(),
}));

import { ScoutingPanel } from "@/components/offseason/ScoutingPanel";

function prospect(overrides: Partial<ProspectDto> = {}): ProspectDto {
  return {
    id: "prospect_1",
    leagueId: "league_1",
    seasonId: "season_1",
    name: "Cam Whitfield",
    position: "WR",
    positionGroup: "WR",
    archetype: "Deep Threat",
    hometown: "Acworth, GA",
    scoutLevel: 0,
    projectedLow: 58,
    projectedHigh: 82,
    scoutedAttributesJson: "{}",
    signedTeamId: null,
    playerId: null,
    ...overrides,
  };
}

const baseProps = {
  seasonId: "season_1",
  teams: [{ id: "team_1", name: "North HS" }],
  actingTeam: { id: "team_1", name: "North HS" },
  canRecruit: true,
  scoutingPointsSpent: 15,
  scoutingPointsTotal: 100,
};

describe("ScoutingPanel", () => {
  it("shows a prospect as a range, never as a single rating", () => {
    /*
     * The one thing this component exists to guarantee. A rendered exact
     * overall — even for a fully scouted prospect — turns recruiting into a
     * lookup, so there is no code path that produces one and this asserts the
     * absence rather than trusting it.
     */
    const html = renderToStaticMarkup(
      createElement(ScoutingPanel, {
        ...baseProps,
        prospects: [prospect({ scoutLevel: 3, projectedLow: 68, projectedHigh: 74 })],
      }),
    );
    expect(html).toContain('data-testid="prospect-range"');
    expect(html).toContain("68–74");
    expect(html).toContain(
      'aria-label="Projected overall between 68 and 74"',
    );
    /*
     * No "Overall 71" style readout anywhere in the markup. The pattern
     * requires a digit directly after the word, so the range's own accessible
     * label ("Projected overall between 68 and 74") is not a false positive —
     * that one is the range, spelled out.
     */
    expect(html).not.toMatch(/overall[:\s]*\d/i);
  });

  it("shows how much of the budget is left", () => {
    const html = renderToStaticMarkup(
      createElement(ScoutingPanel, { ...baseProps, prospects: [prospect()] }),
    );
    expect(html).toContain('data-testid="scouting-points-remaining"');
    expect(html).toContain("85 of 100 scouting points remaining");
  });

  it("prices the next scout so the cost is visible before it is spent", () => {
    const html = renderToStaticMarkup(
      createElement(ScoutingPanel, { ...baseProps, prospects: [prospect()] }),
    );
    expect(html).toContain("Scout (5)");
  });

  it("stops offering scouts once a prospect is fully scouted", () => {
    const html = renderToStaticMarkup(
      createElement(ScoutingPanel, {
        ...baseProps,
        prospects: [prospect({ scoutLevel: 3 })],
      }),
    );
    expect(html).toContain("Fully scouted");
  });

  it("shows who signed a prospect instead of offering him again", () => {
    const html = renderToStaticMarkup(
      createElement(ScoutingPanel, {
        ...baseProps,
        prospects: [
          prospect({ signedTeamId: "team_1", playerId: "player_1" }),
        ],
      }),
    );
    expect(html).toContain("Signed · North HS");
    expect(html).not.toContain("Scout (");
  });

  it("renders read-only for someone who recruits for no team", () => {
    // A league member browsing the board sees the class and no controls.
    const html = renderToStaticMarkup(
      createElement(ScoutingPanel, {
        ...baseProps,
        actingTeam: null,
        canRecruit: false,
        prospects: [prospect()],
      }),
    );
    expect(html).toContain('data-testid="prospect-range"');
    expect(html).not.toContain("Scout (");
    expect(html).not.toContain(">Sign<");
  });

  it("says so plainly when a season has no class", () => {
    // Honest absence — a league with recruiting switched off has an empty
    // board, and an empty list with no explanation reads as a broken page.
    const html = renderToStaticMarkup(
      createElement(ScoutingPanel, { ...baseProps, prospects: [] }),
    );
    expect(html).toContain("No recruiting class was generated");
  });
});

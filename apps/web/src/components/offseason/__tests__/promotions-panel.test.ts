import { createElement } from "react";
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { RosterBoardPlayerDto } from "@/lib/data-api";

vi.mock("@/app/dashboard/_actions/roster-moves", () => ({
  setPlayerSquadAction: vi.fn(),
  changePlayerPositionAction: vi.fn(),
}));
vi.mock("@/app/dashboard/_actions/offseason", () => ({
  releaseToFreeAgencyAction: vi.fn(),
}));
// `ReleasePlayerButton` refreshes the router after a cut; static rendering has
// no app-router context to give it.
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { PromotionsPanel } from "@/components/offseason/PromotionsPanel";

const MINE = { id: "team_1", name: "North HS" };

function player(overrides: Partial<RosterBoardPlayerDto> = {}): RosterBoardPlayerDto {
  return {
    playerId: "player_1",
    name: "Cam Whitfield",
    position: "WR",
    positionGroup: "WR",
    grade: 10,
    squad: "JV",
    overall: 84,
    depthRank: 2,
    attributesJson: JSON.stringify({ SPD: 90, STR: 60, AGI: 88 }),
    ...overrides,
  };
}

const baseProps = { seasonId: "season_1", actingTeam: MINE };

describe("PromotionsPanel", () => {
  it("leads with the decision worth making", () => {
    // A coach opening this cold should not have to compare forty ratings by
    // eye to find the one move his roster is asking for.
    const html = renderToStaticMarkup(
      createElement(PromotionsPanel, {
        ...baseProps,
        players: [
          player(),
          player({
            playerId: "player_2",
            name: "Ty Barrow",
            grade: 12,
            squad: "Varsity",
            overall: 70,
          }),
        ],
      }),
    );
    expect(html).toContain('data-testid="promotion-recommendations"');
    expect(html).toContain("Cam Whitfield");
    expect(html).toContain("better than Ty Barrow");
  });

  it("says so plainly when nobody has outgrown JV", () => {
    const html = renderToStaticMarkup(
      createElement(PromotionsPanel, {
        ...baseProps,
        players: [
          player({ overall: 60 }),
          player({
            playerId: "player_2",
            name: "Ty Barrow",
            grade: 12,
            squad: "Varsity",
            overall: 88,
          }),
        ],
      }),
    );
    expect(html).toContain("Nobody on JV is outplaying your Varsity roster.");
  });

  it("does not offer a move the mutation would reject", () => {
    /*
     * A senior cannot be sent to JV. Rendering the control and letting the
     * server refuse it would make the panel lie about the rules — so the same
     * pure `squadChange` the mutation enforces decides what is offered.
     */
    const html = renderToStaticMarkup(
      createElement(PromotionsPanel, {
        ...baseProps,
        players: [
          player({ name: "Ty Barrow", grade: 12, squad: "Varsity", overall: 70 }),
        ],
      }),
    );
    expect(html).toMatch(/Send to JV[\s\S]{0,200}/);
    expect(html).toContain("disabled");
  });

  it("shows each player's grade and squad — the facts the rules turn on", () => {
    const html = renderToStaticMarkup(
      createElement(PromotionsPanel, { ...baseProps, players: [player()] }),
    );
    expect(html).toContain("Grade 10");
    expect(html).toContain('data-testid="roster-move-squad"');
    expect(html).toContain("JV");
  });

  it("offers a cut through the existing release control", () => {
    // Not a second release path — the same button the free-agency panel uses.
    const html = renderToStaticMarkup(
      createElement(PromotionsPanel, { ...baseProps, players: [player()] }),
    );
    expect(html).toContain("Release Cam Whitfield");
  });

  it("says plainly when a viewer manages no team", () => {
    const html = renderToStaticMarkup(
      createElement(PromotionsPanel, {
        ...baseProps,
        actingTeam: null,
        players: [player()],
      }),
    );
    expect(html).toContain("nothing here to decide");
    expect(html).not.toContain("Cam Whitfield");
  });

  it("renders an empty roster without pretending it has one", () => {
    const html = renderToStaticMarkup(
      createElement(PromotionsPanel, { ...baseProps, players: [] }),
    );
    expect(html).toContain("This roster is empty for the upcoming season.");
  });
});

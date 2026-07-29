import { createElement } from "react";
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type {
  RosterBoardPlayerDto,
  TrainingAllocationDto,
} from "@/lib/data-api";

vi.mock("@/app/dashboard/_actions/training", () => ({
  allocateTrainingAction: vi.fn(),
}));

import { TrainingPanel } from "@/components/offseason/TrainingPanel";

const MINE = { id: "team_1", name: "North HS" };

function player(
  overrides: Partial<RosterBoardPlayerDto> = {},
): RosterBoardPlayerDto {
  return {
    playerId: "player_1",
    name: "Cam Whitfield",
    position: "WR",
    positionGroup: "WR",
    grade: 10,
    squad: "JV",
    overall: 74,
    depthRank: 1,
    attributesJson: JSON.stringify({
      SPD: 70,
      ACC: 68,
      AGI: 72,
      STR: 60,
      AWR: 66,
      CTH: 74,
    }),
    ...overrides,
  };
}

function allocation(
  overrides: Partial<TrainingAllocationDto> = {},
): TrainingAllocationDto {
  return {
    id: "alloc_1",
    seasonId: "season_1",
    teamId: MINE.id,
    playerId: "player_1",
    focus: "athleticism",
    points: 5,
    appliedAt: null,
    appliedGainJson: null,
    createdAt: "2028-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const baseProps = {
  seasonId: "season_1",
  actingTeam: MINE,
  pointsTotal: 100,
};

function render(props: Partial<Parameters<typeof TrainingPanel>[0]> = {}) {
  return renderToStaticMarkup(
    createElement(TrainingPanel, {
      ...baseProps,
      players: [player()],
      allocations: [],
      ...props,
    }),
  );
}

describe("TrainingPanel", () => {
  it("prices every option in the ratings it would move", () => {
    /*
     * The whole reason the panel exists. A budget meter on its own is a chore —
     * you spend to zero because the number is there. Showing what a point BUYS
     * is what makes it a decision.
     */
    const html = render();
    expect(html).toContain("training-preview");
    expect(html).toMatch(/(SPD|ACC|AGI) \+\d/);
  });

  it("shows the budget as a meter and as a number", () => {
    const html = render({ allocations: [allocation({ points: 25 })] });
    expect(html).toContain("training-budget-meter");
    expect(html).toContain("75 of 100 training points remaining");
  });

  it("counts committed points against the budget before they are applied", () => {
    // An allocation is a plan, but it is a SPENT plan — a coach who could
    // re-spend the same points would find the budget meaningless.
    const html = render({
      allocations: [allocation({ points: 10 }), allocation({ id: "a2", points: 15 })],
    });
    expect(html).toContain("75 of 100 training points remaining");
  });

  it("says where a player's points have already gone", () => {
    const html = render({ allocations: [allocation({ points: 10 })] });
    expect(html).toContain("10 pts committed");
  });

  it("disables the control when the budget cannot cover the selection", () => {
    /*
     * The panel and the mutation share `trainingGate`, so a control that is
     * offered is a control that works.
     */
    const html = render({ allocations: [allocation({ points: 99 })] });
    expect(html).toContain("disabled");
  });

  it("admits when a maxed-out player has nowhere to put the points", () => {
    const html = render({
      players: [
        player({
          attributesJson: JSON.stringify({ SPD: 99, ACC: 99, AGI: 99 }),
        }),
      ],
    });
    expect(html).toContain("no headroom");
  });

  it("admits when a player has no ratings to train at all", () => {
    const html = render({ players: [player({ attributesJson: null })] });
    expect(html).toContain("not trainable");
  });

  it("offers every focus the rules accept", () => {
    const html = render();
    for (const label of ["Athleticism", "Strength", "Technique", "Football IQ"]) {
      expect(html).toContain(label);
    }
  });

  it("offers no control to a viewer who manages no team", () => {
    const html = render({ actingTeam: null });
    expect(html).not.toContain("training-commit");
  });

  it("says so plainly when there is nobody to train", () => {
    const html = render({ players: [] });
    expect(html).toContain("nobody on its roster to train");
  });
});

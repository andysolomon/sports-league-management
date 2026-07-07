import { createElement } from "react";
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

import { DraftBoard } from "@/components/offseason/DraftBoard";
import type { DraftDto } from "@/lib/data-api";
import type { FreeAgentRow } from "@/lib/offseason-free-agency";

const TEAMS = [
  { id: "t1", name: "Alpha FC" },
  { id: "t2", name: "Beta FC" },
];

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
    overall: 82,
    teamId: "t1",
  },
];

const ACTIVE_DRAFT: DraftDto = {
  id: "d1",
  leagueId: "l1",
  seasonId: "s1",
  type: "snake",
  rounds: 3,
  order: ["t1", "t2"],
  status: "active",
  currentPick: 2,
  onClockTeamId: "t2",
  picks: [
    {
      id: "pick1",
      round: 1,
      pickNumber: 1,
      teamId: "t1",
      playerId: "p9",
      madeAt: 1,
    },
  ],
};

const COMPLETE_DRAFT: DraftDto = {
  ...ACTIVE_DRAFT,
  status: "complete",
  currentPick: 7,
  onClockTeamId: null,
};

describe("DraftBoard", () => {
  it("renders pool, on-clock banner, and pick history from draft props", () => {
    const html = renderToStaticMarkup(
      createElement(DraftBoard, {
        draft: ACTIVE_DRAFT,
        agents: AGENTS,
        teams: TEAMS,
        playerNames: { p9: "Prior Pick" },
        leagueId: "l1",
        seasonId: "s1",
        isAdmin: true,
      }),
    );
    expect(html).toContain('data-testid="draft-board"');
    expect(html).toContain('data-testid="draft-on-clock"');
    expect(html).toContain('data-testid="draft-pool"');
    expect(html).toContain('data-testid="draft-history"');
    expect(html).toContain("Beta FC");
    expect(html).toContain("Alex Alpha");
    expect(html).toContain("Prior Pick");
    expect(html).toContain('aria-label="Pick Alex Alpha"');
  });

  it("hides pick controls when draft is complete", () => {
    const html = renderToStaticMarkup(
      createElement(DraftBoard, {
        draft: COMPLETE_DRAFT,
        agents: AGENTS,
        teams: TEAMS,
        playerNames: { p9: "Prior Pick" },
        leagueId: "l1",
        seasonId: "s1",
        isAdmin: true,
      }),
    );
    expect(html).toContain('data-testid="draft-complete-banner"');
    expect(html).not.toContain('aria-label="Pick ');
  });

  it("hides pick controls for non-admin users", () => {
    const html = renderToStaticMarkup(
      createElement(DraftBoard, {
        draft: ACTIVE_DRAFT,
        agents: AGENTS,
        teams: TEAMS,
        playerNames: { p9: "Prior Pick" },
        leagueId: "l1",
        seasonId: "s1",
        isAdmin: false,
      }),
    );
    expect(html).not.toContain('aria-label="Pick ');
  });
});

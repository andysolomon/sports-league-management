import { createElement } from "react";
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { TransferDto } from "@/lib/data-api";

vi.mock("@/app/dashboard/_actions/transfers", () => ({
  openTransferWindowAction: vi.fn(),
  resolveTransferAction: vi.fn(),
}));

import { TransferPanel } from "@/components/offseason/TransferPanel";

const MINE = { id: "team_1", name: "North HS" };

function transfer(overrides: Partial<TransferDto> = {}): TransferDto {
  return {
    id: "transfer_1",
    leagueId: "league_1",
    seasonId: "season_1",
    playerId: "player_1",
    playerName: "Cam Whitfield",
    position: "WR",
    grade: 11,
    direction: "out",
    fromTeamId: MINE.id,
    fromTeamName: MINE.name,
    toTeamId: null,
    toTeamName: null,
    reason: "buried",
    likelihood: 0.4,
    status: "pending",
    released: false,
    ...overrides,
  };
}

const baseProps = {
  leagueId: "league_1",
  seasonId: "season_1",
  actingTeam: MINE,
  isAdmin: true,
};

describe("TransferPanel", () => {
  it("separates the two decisions a coach has to make", () => {
    const html = renderToStaticMarkup(
      createElement(TransferPanel, {
        ...baseProps,
        transfers: [
          transfer(),
          transfer({
            id: "transfer_2",
            direction: "in",
            playerId: "player_2",
            playerName: "Dre Alston",
            fromTeamId: "team_2",
            fromTeamName: "South HS",
            toTeamId: MINE.id,
            toTeamName: MINE.name,
            released: true,
          }),
        ],
      }),
    );
    expect(html).toContain('data-testid="transfer-outbound"');
    expect(html).toContain('data-testid="transfer-inbound"');
    expect(html).toContain("Cam Whitfield");
    expect(html).toContain("Dre Alston");
    expect(html).toContain("Keep him");
    expect(html).toContain("Sign him");
  });

  it("explains WHY a player is looking", () => {
    // The reason is the argument the coach answers. A row that just said
    // "wants to transfer" would give him nothing to weigh.
    const html = renderToStaticMarkup(
      createElement(TransferPanel, {
        ...baseProps,
        transfers: [transfer({ reason: "buried" })],
      }),
    );
    expect(html).toContain("Buried on the depth chart");
  });

  it("shows an unreleased offer but does not let it be signed", () => {
    /*
     * Visible and disabled, not hidden. A coach should be able to see who he
     * might get and that he is waiting on somebody else — that tension is the
     * whole point of the two-sided model.
     */
    const html = renderToStaticMarkup(
      createElement(TransferPanel, {
        ...baseProps,
        transfers: [
          transfer({
            direction: "in",
            fromTeamId: "team_2",
            fromTeamName: "South HS",
            toTeamId: MINE.id,
            toTeamName: MINE.name,
            released: false,
          }),
        ],
      }),
    );
    expect(html).toContain("awaiting release");
    expect(html).toMatch(/Sign him[\s\S]{0,40}$|disabled/);
  });

  it("distinguishes a decision this coach made from one taken away", () => {
    // "We passed" and "we never got the chance" are different stories.
    const rejected = renderToStaticMarkup(
      createElement(TransferPanel, {
        ...baseProps,
        transfers: [
          transfer({
            direction: "in",
            toTeamId: MINE.id,
            status: "rejected",
          }),
        ],
      }),
    );
    const withdrawn = renderToStaticMarkup(
      createElement(TransferPanel, {
        ...baseProps,
        transfers: [
          transfer({
            direction: "in",
            toTeamId: MINE.id,
            status: "withdrawn",
          }),
        ],
      }),
    );
    expect(rejected).toContain("Declined");
    expect(withdrawn).toContain("No longer available");
  });

  it("shows only this team's decisions", () => {
    // Another program's outbound player is not this coach's call, and showing
    // it with buttons would imply otherwise.
    const html = renderToStaticMarkup(
      createElement(TransferPanel, {
        ...baseProps,
        transfers: [
          transfer({
            playerName: "Someone Else",
            fromTeamId: "team_9",
            fromTeamName: "West HS",
          }),
        ],
      }),
    );
    expect(html).not.toContain("Someone Else");
    expect(html).toContain("Nobody on your roster is looking to move.");
  });

  it("offers an admin the window when none has been opened", () => {
    const html = renderToStaticMarkup(
      createElement(TransferPanel, { ...baseProps, transfers: [] }),
    );
    expect(html).toContain('data-testid="open-transfer-window"');
    expect(html).toContain("has not been opened");
  });

  it("does not offer a non-admin the window", () => {
    const html = renderToStaticMarkup(
      createElement(TransferPanel, {
        ...baseProps,
        isAdmin: false,
        transfers: [],
      }),
    );
    expect(html).not.toContain('data-testid="open-transfer-window"');
  });

  it("says plainly when a viewer manages no team", () => {
    const html = renderToStaticMarkup(
      createElement(TransferPanel, {
        ...baseProps,
        actingTeam: null,
        transfers: [transfer()],
      }),
    );
    expect(html).toContain("nothing here to decide");
  });
});

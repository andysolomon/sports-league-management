import { describe, expect, it } from "vitest";
import {
  PRODUCING_EVENT_TYPES,
  renderHeadline,
  type NarrativeInput,
} from "../../../../convex/lib/narrative";

const PRODUCER_INPUTS: Record<
  (typeof PRODUCING_EVENT_TYPES)[number],
  NarrativeInput
> = {
  game_final: {
    type: "game_final",
    winnerName: "North",
    loserName: "South",
    winnerScore: 21,
    loserScore: 20,
    tie: false,
    week: 1,
  },
  player_injured: {
    type: "player_injured",
    playerName: "Alex Runner",
    teamName: "North",
    label: "Ankle sprain",
    gamesOut: 2,
    week: 3,
  },
  transfer_completed: {
    type: "transfer_completed",
    playerName: "Casey Thrower",
    fromTeamName: "North",
    toTeamName: "South",
    position: "QB",
  },
  transfer_retained: {
    type: "transfer_retained",
    playerName: "Jordan Catcher",
    teamName: "North",
    position: "WR",
  },
  coach_fired: {
    type: "coach_fired",
    coachName: "Pat Coach",
    teamName: "South",
    seasonName: "2026",
  },
  award_won: {
    type: "award_won",
    recipientName: "Morgan Back",
    awardName: "Player of the Year",
    positionGroup: "RB",
  },
};

describe("dynasty narrative producer coverage", () => {
  it("enumerates every current emitter and renders specific copy", () => {
    expect(PRODUCING_EVENT_TYPES).toEqual([
      "game_final",
      "player_injured",
      "transfer_completed",
      "transfer_retained",
      "coach_fired",
      "award_won",
    ]);

    for (const type of PRODUCING_EVENT_TYPES) {
      const headline = renderHeadline(PRODUCER_INPUTS[type]);
      expect(headline).not.toBe("A notable dynasty event occurred");
      expect(headline.length).toBeGreaterThan(10);
    }
  });
});

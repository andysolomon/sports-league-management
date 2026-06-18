import { describe, it, expect } from "vitest";
import {
  isLiveVisible,
  overlayPeriodLabel,
  cardStatusLabel,
  abbreviateTeam,
} from "../live-score-view";
import type { LiveScorePublic } from "../use-live-score";

const base: LiveScorePublic = {
  homeScore: 14,
  awayScore: 7,
  period: 2,
  clock: "03:21",
  status: "in_progress",
};

describe("isLiveVisible", () => {
  it("shows for live/halftime, hides for null and final", () => {
    expect(isLiveVisible(base)).toBe(true);
    expect(isLiveVisible({ ...base, status: "halftime" })).toBe(true);
    expect(isLiveVisible(null)).toBe(false);
    expect(isLiveVisible({ ...base, status: "final" })).toBe(false);
  });
});

describe("overlayPeriodLabel", () => {
  it("renders quarter + clock when running", () => {
    expect(overlayPeriodLabel(base)).toBe("Q2 03:21");
  });

  it("drops the clock when there isn't one", () => {
    expect(overlayPeriodLabel({ ...base, clock: null })).toBe("Q2");
  });

  it("shows Half at halftime regardless of clock", () => {
    expect(overlayPeriodLabel({ ...base, status: "halftime" })).toBe("Half");
  });
});

describe("cardStatusLabel", () => {
  it("maps halftime, else Live", () => {
    expect(cardStatusLabel(base)).toBe("Live");
    expect(cardStatusLabel({ ...base, status: "halftime" })).toBe("Halftime");
  });
});

describe("abbreviateTeam", () => {
  it("takes the first three letters, upper-cased, trimmed", () => {
    expect(abbreviateTeam("Cobb County Hawks")).toBe("COB");
    expect(abbreviateTeam("  raiders")).toBe("RAI");
    expect(abbreviateTeam("KC")).toBe("KC");
  });
});

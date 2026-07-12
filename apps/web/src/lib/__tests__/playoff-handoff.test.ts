import { describe, expect, it } from "vitest";
import {
  resolvePlayoffHandoff,
  type PlayoffHandoffInput,
} from "../playoff-handoff";

function input(overrides: Partial<PlayoffHandoffInput> = {}): PlayoffHandoffInput {
  return {
    playoffsEnabled: true,
    viewedSeasonId: "s1",
    viewedSeasonStatus: "active",
    decidedSeasonId: "s1",
    playoffTeams: 4,
    regularTotal: 6,
    regularComplete: true,
    bracketExists: false,
    canManage: true,
    ...overrides,
  };
}

describe("resolvePlayoffHandoff", () => {
  it("offers the start button to a manager when the decided active season is complete", () => {
    expect(resolvePlayoffHandoff(input())).toBe("start");
  });

  it("shows the non-interactive waiting state for a read-only role", () => {
    expect(resolvePlayoffHandoff(input({ canManage: false }))).toBe("waiting");
  });

  it("hides the handoff when the playoffs flag is off", () => {
    expect(resolvePlayoffHandoff(input({ playoffsEnabled: false }))).toBe(
      "hidden",
    );
  });

  it("hides the handoff when viewing a season other than the decided one", () => {
    expect(resolvePlayoffHandoff(input({ viewedSeasonId: "s0" }))).toBe(
      "hidden",
    );
  });

  it("hides the handoff on a completed season even if it is the decided season", () => {
    // resolveLifecycleSeason falls back to the newest season of ANY status,
    // so a league whose only season is completed still "decides" it — the
    // status check keeps the button off read-only history.
    expect(
      resolvePlayoffHandoff(input({ viewedSeasonStatus: "completed" })),
    ).toBe("hidden");
  });

  it("hides the handoff when no season is viewed", () => {
    expect(
      resolvePlayoffHandoff(
        input({ viewedSeasonId: null, viewedSeasonStatus: null }),
      ),
    ).toBe("hidden");
  });

  it("hides the handoff when playoffs are not configured", () => {
    expect(resolvePlayoffHandoff(input({ playoffTeams: null }))).toBe("hidden");
    expect(resolvePlayoffHandoff(input({ playoffTeams: 0 }))).toBe("hidden");
    expect(resolvePlayoffHandoff(input({ playoffTeams: 1 }))).toBe("hidden");
  });

  it("hides the handoff while the regular season is incomplete", () => {
    expect(resolvePlayoffHandoff(input({ regularComplete: false }))).toBe(
      "hidden",
    );
  });

  it("hides the handoff on an empty schedule even though it is vacuously complete", () => {
    expect(resolvePlayoffHandoff(input({ regularTotal: 0 }))).toBe("hidden");
  });

  it("hides the handoff once a bracket exists", () => {
    expect(resolvePlayoffHandoff(input({ bracketExists: true }))).toBe(
      "hidden",
    );
  });
});

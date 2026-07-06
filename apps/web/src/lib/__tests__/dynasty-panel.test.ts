import { describe, it, expect } from "vitest";
import {
  dynastySeasonState,
  evaluateStartNextSeason,
  formatRolloverSuccessSummary,
  seasonDecidedContext,
  shouldShowDynastyCta,
  startNextSeasonErrorMessage,
} from "../dynasty-panel";
import type { FixtureDto } from "@sports-management/shared-types";

const finalFixture = (id: string): FixtureDto => ({
  id,
  seasonId: "s1",
  homeTeamId: "h",
  awayTeamId: "a",
  homeTeamName: "H",
  awayTeamName: "A",
  scheduledAt: null,
  week: 1,
  venue: null,
  status: "final",
  stage: "regular",
  createdAt: "",
  createdBy: "",
});

describe("dynastySeasonState", () => {
  it("labels in-progress, decided, and offseason states", () => {
    expect(
      dynastySeasonState({
        activeSeason: { name: "2026" },
        upcomingSeason: null,
        seasonDecided: false,
      }),
    ).toMatchObject({ status: "in_progress", statusLabel: "In progress" });

    expect(
      dynastySeasonState({
        activeSeason: { name: "2026" },
        upcomingSeason: null,
        seasonDecided: true,
      }),
    ).toMatchObject({ status: "decided", statusLabel: "Decided" });

    expect(
      dynastySeasonState({
        activeSeason: { name: "2026" },
        upcomingSeason: { name: "2027" },
        seasonDecided: true,
      }),
    ).toMatchObject({
      status: "offseason_upcoming",
      statusLabel: "Offseason · upcoming 2027",
    });
  });
});

describe("seasonDecidedContext", () => {
  it("reports unplayed regular-season games", () => {
    const ctx = seasonDecidedContext(
      [finalFixture("f1"), { ...finalFixture("f2"), status: "scheduled" }],
      null,
    );
    expect(ctx.seasonDecided).toBe(false);
    expect(ctx.unplayedGames).toBe(1);
    expect(ctx.playoffsUndecided).toBe(false);
  });

  it("flags undecided playoffs when a bracket exists", () => {
    const ctx = seasonDecidedContext([], {
      bracketId: "b1",
      size: 4,
      rounds: 2,
      format: "single",
      matchups: [{ id: "m1" } as never],
      champion: null,
    });
    expect(ctx.playoffsUndecided).toBe(true);
  });
});

describe("startNextSeasonErrorMessage", () => {
  it("maps season_not_decided to unplayed games or playoffs", () => {
    expect(
      startNextSeasonErrorMessage("season_not_decided", { unplayedGames: 3 }),
    ).toBe("3 games unplayed.");
    expect(
      startNextSeasonErrorMessage("season_not_decided", {
        playoffsUndecided: true,
      }),
    ).toBe("Playoffs undecided.");
  });

  it("mentions the upcoming season when it already exists", () => {
    expect(
      startNextSeasonErrorMessage("next_season_exists", {
        upcomingSeason: { id: "s2", name: "2027" },
      }),
    ).toContain("2027");
  });
});

describe("evaluateStartNextSeason", () => {
  const active = { id: "s1", name: "2026" };

  it("blocks when preconditions fail", () => {
    expect(
      evaluateStartNextSeason({
        activeSeason: null,
        upcomingSeason: null,
        seasonDecided: false,
        unplayedGames: 0,
        playoffsUndecided: false,
      }).errorCode,
    ).toBe("no_season");

    expect(
      evaluateStartNextSeason({
        activeSeason: active,
        upcomingSeason: { id: "s2", name: "2027" },
        seasonDecided: true,
        unplayedGames: 0,
        playoffsUndecided: false,
      }).errorCode,
    ).toBe("next_season_exists");

    expect(
      evaluateStartNextSeason({
        activeSeason: active,
        upcomingSeason: null,
        seasonDecided: false,
        unplayedGames: 2,
        playoffsUndecided: false,
      }),
    ).toMatchObject({
      canStart: false,
      message: "2 games unplayed.",
    });
  });

  it("allows start when the active season is decided and no upcoming season", () => {
    expect(
      evaluateStartNextSeason({
        activeSeason: active,
        upcomingSeason: null,
        seasonDecided: true,
        unplayedGames: 0,
        playoffsUndecided: false,
      }),
    ).toEqual({ canStart: true, errorCode: null, message: null });
  });
});

describe("formatRolloverSuccessSummary", () => {
  it("joins rollover counts into a readable summary", () => {
    expect(
      formatRolloverSuccessSummary({
        graduated: 12,
        advanced: 36,
        freshmen: 24,
        progressed: 36,
      }),
    ).toContain("12 graduated");
    expect(
      formatRolloverSuccessSummary({
        graduated: 1,
        advanced: 1,
        freshmen: 1,
      }),
    ).toBe("1 graduated · 1 advanced · 1 freshman generated");
  });
});

describe("shouldShowDynastyCta", () => {
  it("shows only when the game is final, season decided, and no upcoming season", () => {
    expect(
      shouldShowDynastyCta({
        gameFinal: true,
        seasonDecided: true,
        upcomingSeasonExists: false,
      }),
    ).toBe(true);

    expect(
      shouldShowDynastyCta({
        gameFinal: false,
        seasonDecided: true,
        upcomingSeasonExists: false,
      }),
    ).toBe(false);

    expect(
      shouldShowDynastyCta({
        gameFinal: true,
        seasonDecided: false,
        upcomingSeasonExists: false,
      }),
    ).toBe(false);

    expect(
      shouldShowDynastyCta({
        gameFinal: true,
        seasonDecided: true,
        upcomingSeasonExists: true,
      }),
    ).toBe(false);
  });
});

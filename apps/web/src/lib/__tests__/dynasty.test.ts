import { describe, it, expect } from "vitest";
import {
  incrementSeasonName,
  isSeasonDecided,
  activeNonGraduatedNames,
} from "../dynasty";
import type { FixtureDto } from "@sports-management/shared-types";
import type { PlayoffMatchupDto } from "../data-api";

describe("incrementSeasonName", () => {
  it("increments a trailing year", () => {
    expect(incrementSeasonName("2026")).toBe("2027");
    expect(incrementSeasonName("Fall 2025")).toBe("Fall 2026");
  });

  it("increments an embedded year when not trailing", () => {
    expect(incrementSeasonName("Season 2024 Playoffs")).toBe(
      "Season 2025 Playoffs",
    );
  });
});

describe("isSeasonDecided", () => {
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

  it("requires a champion when a bracket exists", () => {
    const undecided = isSeasonDecided([], {
      bracketId: "b1",
      size: 4,
      rounds: 2,
      format: "single",
      matchups: [
        {
          id: "m1",
          round: 2,
          slot: 1,
          homeSeed: 1,
          awaySeed: 2,
          homeTeamId: "h",
          awayTeamId: "a",
          homeTeamName: "H",
          awayTeamName: "A",
          homeScore: null,
          awayScore: null,
          winnerTeamId: null,
          fixtureId: null,
          bracketType: "winners",
          status: null,
          isBye: false,
          hasPlayLog: false,
        } satisfies PlayoffMatchupDto,
      ],
      champion: null,
    });
    expect(undecided).toBe(false);

    const decided = isSeasonDecided([], {
      bracketId: "b1",
      size: 4,
      rounds: 2,
      format: "single",
      matchups: [],
      champion: { teamId: "h", teamName: "H" },
    });
    expect(decided).toBe(true);
  });

  it("falls back to all regular fixtures final when no bracket", () => {
    expect(
      isSeasonDecided(
        [finalFixture("f1"), { ...finalFixture("f2"), status: "scheduled" }],
        null,
      ),
    ).toBe(false);
    expect(isSeasonDecided([finalFixture("f1"), finalFixture("f2")], null)).toBe(
      true,
    );
    expect(isSeasonDecided([], null)).toBe(true);
  });
});

describe("activeNonGraduatedNames", () => {
  it("excludes graduated players from dedup", () => {
    const names = activeNonGraduatedNames([
      {
        id: "1",
        name: "Pat Lee",
        teamId: "t",
        position: "QB",
        positionGroup: null,
        jerseyNumber: 1,
        dateOfBirth: null,
        status: "graduated",
        headshotUrl: null,
        experienceYears: 3,
        grade: 12,
        squad: "Varsity",
        hometown: null,
      },
      {
        id: "2",
        name: "Sam Smith",
        teamId: "t",
        position: "RB",
        positionGroup: null,
        jerseyNumber: 2,
        dateOfBirth: null,
        status: "Active",
        headshotUrl: null,
        experienceYears: 1,
        grade: 10,
        squad: "JV",
        hometown: null,
      },
    ]);
    expect(names).toEqual(["Sam Smith"]);
  });
});

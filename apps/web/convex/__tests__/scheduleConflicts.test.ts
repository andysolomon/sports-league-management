import { describe, expect, it } from "vitest";
import {
  findWeekConflict,
  isValidWeek,
  type WeekFixture,
} from "../lib/scheduleConflicts";

const weekThree: WeekFixture[] = [
  {
    id: "fixture-1",
    week: 3,
    homeTeamId: "team-a",
    awayTeamId: "team-b",
  },
];

describe("schedule conflicts", () => {
  it.each([0, -1, -20, 1.5, null])("rejects invalid week %s", (week) => {
    expect(isValidWeek(week)).toBe(false);
  });

  it("accepts positive integer weeks", () => {
    expect(isValidWeek(1)).toBe(true);
    expect(isValidWeek(12)).toBe(true);
  });

  it("detects a conflict for the candidate home team", () => {
    expect(
      findWeekConflict(weekThree, {
        week: 3,
        homeTeamId: "team-a",
        awayTeamId: "team-c",
      }),
    ).toBe("team-a");
  });

  it("detects a conflict for the candidate away team", () => {
    expect(
      findWeekConflict(weekThree, {
        week: 3,
        homeTeamId: "team-c",
        awayTeamId: "team-b",
      }),
    ).toBe("team-b");
  });

  it("ignores the fixture being edited", () => {
    expect(
      findWeekConflict(weekThree, {
        week: 3,
        homeTeamId: "team-a",
        awayTeamId: "team-b",
        excludeFixtureId: "fixture-1",
      }),
    ).toBeNull();
  });

  it("returns null when both teams are free", () => {
    expect(
      findWeekConflict(weekThree, {
        week: 4,
        homeTeamId: "team-a",
        awayTeamId: "team-c",
      }),
    ).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import {
  groupFixturesByWeek,
  initialOpenWeekKeys,
  isFixtureDone,
  weekKey,
  weekLabel,
  type FixtureLite,
} from "../schedule-weeks";

interface Row {
  fixture: FixtureLite & { id: string };
}

function row(id: string, week: number | null, status: string): Row {
  return { fixture: { id, week, status } };
}

const getFixture = (r: Row) => r.fixture;

describe("weekKey / weekLabel", () => {
  it("produces stable keys for numeric weeks and the unscheduled bucket", () => {
    expect(weekKey(1)).toBe("week-1");
    expect(weekKey(12)).toBe("week-12");
    expect(weekKey(null)).toBe("unscheduled");
    expect(weekLabel(3)).toBe("Week 3");
    expect(weekLabel(null)).toBe("Unscheduled");
  });
});

describe("isFixtureDone", () => {
  it("treats final and cancelled as done, everything else as not done", () => {
    expect(isFixtureDone("final")).toBe(true);
    expect(isFixtureDone("cancelled")).toBe(true);
    expect(isFixtureDone("scheduled")).toBe(false);
    expect(isFixtureDone("live")).toBe(false);
    expect(isFixtureDone("in_progress")).toBe(false);
  });
});

describe("groupFixturesByWeek", () => {
  it("classifies an all-final week as completed", () => {
    const groups = groupFixturesByWeek(
      [row("a", 1, "final"), row("b", 1, "final")],
      getFixture,
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].status).toBe("completed");
    expect(groups[0].completedRows).toHaveLength(2);
    expect(groups[0].remainingRows).toHaveLength(0);
  });

  it("classifies an all-cancelled week as completed", () => {
    const groups = groupFixturesByWeek(
      [row("a", 2, "cancelled"), row("b", 2, "cancelled")],
      getFixture,
    );
    expect(groups[0].status).toBe("completed");
  });

  it("classifies a week with some done and some not as mixed, splitting the rows", () => {
    const groups = groupFixturesByWeek(
      [
        row("a", 1, "final"),
        row("b", 1, "scheduled"),
        row("c", 1, "cancelled"),
      ],
      getFixture,
    );
    expect(groups[0].status).toBe("mixed");
    expect(groups[0].completedRows.map((r) => r.fixture.id)).toEqual([
      "a",
      "c",
    ]);
    expect(groups[0].remainingRows.map((r) => r.fixture.id)).toEqual(["b"]);
  });

  it("classifies an all-scheduled week as upcoming", () => {
    const groups = groupFixturesByWeek(
      [row("a", 4, "scheduled"), row("b", 4, "scheduled")],
      getFixture,
    );
    expect(groups[0].status).toBe("upcoming");
    expect(groups[0].completedRows).toHaveLength(0);
    expect(groups[0].remainingRows).toHaveLength(2);
  });

  it("counts a live fixture as NOT completed (week with finals + a live game is mixed)", () => {
    const groups = groupFixturesByWeek(
      [row("a", 1, "final"), row("b", 1, "live")],
      getFixture,
    );
    expect(groups[0].status).toBe("mixed");
    expect(groups[0].remainingRows.map((r) => r.fixture.id)).toEqual(["b"]);
  });

  it("keeps a week of only live games open (upcoming, not completed)", () => {
    const groups = groupFixturesByWeek([row("a", 1, "live")], getFixture);
    expect(groups[0].status).toBe("upcoming");
  });

  it("applies the same classification to the unscheduled bucket", () => {
    const groups = groupFixturesByWeek(
      [row("a", null, "final"), row("b", null, "cancelled")],
      getFixture,
    );
    expect(groups[0].key).toBe("unscheduled");
    expect(groups[0].label).toBe("Unscheduled");
    expect(groups[0].status).toBe("completed");
  });

  it("sorts numeric weeks ascending with the unscheduled bucket last", () => {
    const groups = groupFixturesByWeek(
      [
        row("u", null, "scheduled"),
        row("c", 3, "scheduled"),
        row("a", 1, "scheduled"),
        row("b", 2, "scheduled"),
      ],
      getFixture,
    );
    expect(groups.map((g) => g.key)).toEqual([
      "week-1",
      "week-2",
      "week-3",
      "unscheduled",
    ]);
    expect(groups.map((g) => g.label)).toEqual([
      "Week 1",
      "Week 2",
      "Week 3",
      "Unscheduled",
    ]);
  });

  it("preserves input row order within a bucket", () => {
    const groups = groupFixturesByWeek(
      [row("first", 1, "scheduled"), row("second", 1, "final")],
      getFixture,
    );
    expect(groups[0].rows.map((r) => r.fixture.id)).toEqual([
      "first",
      "second",
    ]);
  });

  it("returns no groups for an empty schedule", () => {
    expect(groupFixturesByWeek([], getFixture)).toEqual([]);
  });
});

describe("initialOpenWeekKeys", () => {
  it("opens upcoming and mixed weeks, closes completed weeks", () => {
    const groups = groupFixturesByWeek(
      [
        row("a", 1, "final"), // week 1 completed → closed
        row("b", 2, "final"),
        row("c", 2, "scheduled"), // week 2 mixed → open
        row("d", 3, "scheduled"), // week 3 upcoming → open
        row("e", null, "scheduled"), // unscheduled upcoming → open
      ],
      getFixture,
    );
    expect(initialOpenWeekKeys(groups)).toEqual([
      "week-2",
      "week-3",
      "unscheduled",
    ]);
  });

  it("returns an empty list when every week is completed", () => {
    const groups = groupFixturesByWeek(
      [row("a", 1, "final"), row("b", 2, "cancelled")],
      getFixture,
    );
    expect(initialOpenWeekKeys(groups)).toEqual([]);
  });
});

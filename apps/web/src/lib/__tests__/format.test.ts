import { describe, it, expect } from "vitest";
import { formatFixtureWhen } from "../format";

describe("formatFixtureWhen (WSM-000161)", () => {
  it("returns TBD for a null scheduledAt", () => {
    expect(formatFixtureWhen(null)).toBe("TBD");
  });

  it("renders a date-only fixture (noon-UTC anchor) as a date with no time", () => {
    // Generator anchors date-only kickoffs to noon UTC.
    const out = formatFixtureWhen("2026-09-05T12:00:00.000Z");
    // No clock time should leak through (no ":" from H:MM, no AM/PM marker).
    expect(out).not.toMatch(/\d:\d/);
    expect(out).not.toMatch(/[AP]M/i);
    // The UTC calendar day must be preserved.
    expect(out).toContain("Sep");
    expect(out).toContain("5");
    expect(out).toContain("2026");
  });

  it("uses the UTC calendar day so the date does not shift across timezones", () => {
    // Noon UTC is the same calendar day everywhere on Earth, so regardless of
    // the test runner's local timezone the day must read as Sep 5.
    const out = formatFixtureWhen("2026-09-05T12:00:00.000Z");
    // "Sep 5, 2026" with a weekday prefix; assert the day number is 5 and not
    // a neighboring day that a TZ offset could have produced.
    expect(out).toMatch(/\bSep\b/);
    expect(out).toMatch(/\b5\b/);
    expect(out).not.toMatch(/\b4\b/);
    expect(out).not.toMatch(/\b6\b/);
  });

  it("renders a real kickoff time as date + time", () => {
    // A non-noon-UTC time is a real kickoff and must keep the time component.
    const out = formatFixtureWhen("2026-09-05T19:30:00.000Z");
    // toLocaleString() includes a clock time (H:MM somewhere in the string).
    expect(out).toMatch(/\d{1,2}:\d{2}/);
  });

  it("treats a non-zero seconds/ms value as a real time, not date-only", () => {
    const out = formatFixtureWhen("2026-09-05T12:00:30.000Z");
    expect(out).toMatch(/\d{1,2}:\d{2}/);
  });
});

import { describe, it, expect } from "vitest";
import {
  MAX_PERIOD,
  REGULATION_PERIODS,
  formatPeriodLabel,
  isOvertimePeriod,
  isRegulationPeriod,
  isValidPeriod,
  nextPeriod,
  nextPeriodLabel,
} from "../lib/gamePeriods";

describe("football period structure", () => {
  it("treats exactly four periods as regulation", () => {
    expect(REGULATION_PERIODS).toBe(4);
    for (const p of [1, 2, 3, 4]) {
      expect(isRegulationPeriod(p)).toBe(true);
      expect(isOvertimePeriod(p)).toBe(false);
    }
    expect(isRegulationPeriod(5)).toBe(false);
    expect(isOvertimePeriod(5)).toBe(true);
  });

  it("labels quarters and overtimes the way a scoreboard does", () => {
    expect(formatPeriodLabel(1)).toBe("Q1");
    expect(formatPeriodLabel(4)).toBe("Q4");
    expect(formatPeriodLabel(5)).toBe("OT");
    expect(formatPeriodLabel(6)).toBe("2OT");
    expect(formatPeriodLabel(7)).toBe("3OT");
  });

  it("renders a placeholder rather than throwing on a bogus value", () => {
    // A row written before the bound existed must still display.
    expect(formatPeriodLabel(0)).toBe("—");
    expect(formatPeriodLabel(-3)).toBe("—");
    expect(formatPeriodLabel(1.5)).toBe("—");
  });

  it("rejects a period outside 1..MAX_PERIOD", () => {
    expect(isValidPeriod(1)).toBe(true);
    expect(isValidPeriod(MAX_PERIOD)).toBe(true);
    expect(isValidPeriod(0)).toBe(false);
    expect(isValidPeriod(MAX_PERIOD + 1)).toBe(false);
    expect(isValidPeriod(2.5)).toBe(false);
  });

  it("names the advance control by what it actually does", () => {
    expect(nextPeriodLabel(1)).toBe("Next quarter");
    expect(nextPeriodLabel(3)).toBe("Next quarter");
    expect(nextPeriodLabel(4)).toBe("Start overtime");
    expect(nextPeriodLabel(5)).toBe("Next overtime");
  });

  it("stops advancing at the cap instead of counting forever", () => {
    expect(nextPeriod(1)).toBe(2);
    expect(nextPeriod(4)).toBe(5);
    expect(nextPeriod(MAX_PERIOD)).toBeNull();
  });
});

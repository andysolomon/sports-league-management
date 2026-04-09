import { describe, it, expect, beforeEach } from "vitest";
import { errorTracker } from "../lib/error-tracker.js";

const makeError = (i: number) => ({
  timestamp: new Date().toISOString(),
  status: 500 + i,
  route: `/api/test/${i}`,
  message: `Error ${i}`,
  payload: { detail: `failure ${i}` },
});

describe("errorTracker", () => {
  beforeEach(() => errorTracker.clear());

  it("starts empty", () => {
    expect(errorTracker.getRecent()).toEqual([]);
  });

  it("records errors in reverse chronological order", () => {
    errorTracker.record(makeError(1));
    errorTracker.record(makeError(2));
    const errors = errorTracker.getRecent();
    expect(errors).toHaveLength(2);
    expect(errors[0].route).toBe("/api/test/2");
  });

  it("caps at 10 errors", () => {
    for (let i = 0; i < 15; i++) errorTracker.record(makeError(i));
    expect(errorTracker.getRecent()).toHaveLength(10);
  });

  it("clears all errors", () => {
    errorTracker.record(makeError(1));
    errorTracker.clear();
    expect(errorTracker.getRecent()).toEqual([]);
  });
});

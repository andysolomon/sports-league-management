import { describe, it, expect, beforeEach } from "vitest";
import { apiTracker } from "../lib/api-tracker.js";

const makeCall = (i: number) => ({
  method: "GET",
  path: `/api/test/${i}`,
  status: 200,
  durationMs: 50 + i,
  timestamp: new Date().toISOString(),
});

describe("apiTracker", () => {
  beforeEach(() => apiTracker.clear());

  it("starts empty", () => {
    expect(apiTracker.getRecent()).toEqual([]);
  });

  it("records calls in reverse chronological order", () => {
    apiTracker.record(makeCall(1));
    apiTracker.record(makeCall(2));
    const calls = apiTracker.getRecent();
    expect(calls).toHaveLength(2);
    expect(calls[0].path).toBe("/api/test/2");
    expect(calls[1].path).toBe("/api/test/1");
  });

  it("caps at 20 calls", () => {
    for (let i = 0; i < 25; i++) apiTracker.record(makeCall(i));
    expect(apiTracker.getRecent()).toHaveLength(20);
  });

  it("clears all calls", () => {
    apiTracker.record(makeCall(1));
    apiTracker.clear();
    expect(apiTracker.getRecent()).toEqual([]);
  });

  it("returns a copy, not a reference", () => {
    apiTracker.record(makeCall(1));
    const a = apiTracker.getRecent();
    const b = apiTracker.getRecent();
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });
});

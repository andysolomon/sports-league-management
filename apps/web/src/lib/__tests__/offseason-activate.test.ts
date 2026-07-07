import { describe, it, expect } from "vitest";
import {
  activateSeasonWarningMessage,
  teamsBelowTargetRoster,
} from "@/lib/offseason-activate";

describe("offseason-activate helpers", () => {
  it("flags teams below the target roster size", () => {
    const undersized = teamsBelowTargetRoster([
      { id: "t1", name: "Alpha", activeCount: 48 },
      { id: "t2", name: "Beta", activeCount: 10 },
    ]);
    expect(undersized).toEqual([
      { id: "t2", name: "Beta", activeCount: 10, target: 48 },
    ]);
  });

  it("builds a warning message for activate confirmation", () => {
    const message = activateSeasonWarningMessage([
      { id: "t2", name: "Beta", activeCount: 10, target: 48 },
    ]);
    expect(message).toContain("target roster size of 48");
    expect(message).toContain("Beta (10/48)");
  });
});

import { describe, it, expect } from "vitest";
import { activateSeasonWarningMessage } from "@/lib/offseason-activate";

describe("activate season guard warning", () => {
  it("describes undersized teams for the confirmation dialog", () => {
    const message = activateSeasonWarningMessage([
      { id: "t1", name: "Alpha FC", activeCount: 12, target: 48 },
    ]);
    expect(message).toContain("target roster size of 48");
    expect(message).toContain("Alpha FC (12/48)");
    expect(message).toContain("You can still activate");
  });
});

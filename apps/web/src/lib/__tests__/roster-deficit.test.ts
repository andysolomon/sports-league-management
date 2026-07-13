import { describe, it, expect } from "vitest";
import {
  activeRosterCountByTeam,
  buildLeagueRosterDeficitProjection,
  undersizedRosterSummaryMessage,
  withRosterDeficit,
} from "@/lib/roster-deficit";

describe("roster-deficit helpers", () => {
  it("counts only active non-graduated players per team", () => {
    const counts = activeRosterCountByTeam([
      { teamId: "t1", status: "active" },
      { teamId: "t1", status: "active" },
      { teamId: "t1", status: "graduated" },
      { teamId: "t2", status: "active" },
    ]);
    expect(counts.get("t1")).toBe(2);
    expect(counts.get("t2")).toBe(1);
  });

  it("projects only deficient teams with deficit counts", () => {
    const projection = buildLeagueRosterDeficitProjection(
      [
        { id: "t1", name: "Alpha" },
        { id: "t2", name: "Beta" },
        { id: "t3", name: "Gamma" },
      ],
      new Map([
        ["t1", 48],
        ["t2", 10],
        ["t3", 47],
      ]),
      48,
    );
    expect(projection.target).toBe(48);
    expect(projection.teams).toEqual([
      { id: "t2", name: "Beta", activeCount: 10, target: 48, deficit: 38 },
      { id: "t3", name: "Gamma", activeCount: 47, target: 48, deficit: 1 },
    ]);
  });

  it("adds deficit to undersized teams", () => {
    expect(
      withRosterDeficit({ id: "t1", name: "Beta", activeCount: 10, target: 48 }),
    ).toEqual({
      id: "t1",
      name: "Beta",
      activeCount: 10,
      target: 48,
      deficit: 38,
    });
  });

  it("builds a summary message for undersized teams", () => {
    const message = undersizedRosterSummaryMessage(
      [{ id: "t2", name: "Beta", activeCount: 10, target: 48, deficit: 38 }],
      48,
    );
    expect(message).toContain("target roster size of 48");
    expect(message).toContain("Beta (10/48)");
  });
});

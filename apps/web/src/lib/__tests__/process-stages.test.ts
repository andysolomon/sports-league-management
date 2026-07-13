import { describe, it, expect } from "vitest";
import {
  dynastyRolloverProcessStages,
  rosterAutoFillProcessStages,
  rosterGenerateProcessStages,
  scheduleProcessStages,
} from "@/lib/process-stages";

describe("process stage builders", () => {
  it("builds schedule stages from action results", () => {
    const pending = scheduleProcessStages("pending");
    expect(pending[0]).toMatchObject({
      id: "generate",
      status: "in_progress",
    });

    const success = scheduleProcessStages("success", {
      created: 28,
      weeks: 7,
      teamCount: 8,
    });
    expect(success[0]).toMatchObject({
      id: "generate",
      status: "complete",
      detail: "28 games · 7 weeks · 8 teams",
    });
  });

  it("builds roster generation stages for league scope", () => {
    const success = rosterGenerateProcessStages("success", "league", {
      created: 96,
      teams: 2,
    });
    expect(success[0]).toMatchObject({
      id: "fill",
      status: "complete",
      detail: "96 players across 2 teams",
    });
  });

  it("builds auto-fill stages from created totals", () => {
    const success = rosterAutoFillProcessStages("success", {
      created: 38,
      teamsFilled: 1,
    });
    expect(success[0]).toMatchObject({
      id: "autofill",
      status: "complete",
      detail: "38 players across 1 team",
    });
  });

  it("builds stable dynasty rollover stages from the persisted summary", () => {
    const pending = dynastyRolloverProcessStages("pending");
    expect(pending.map((stage) => stage.id)).toEqual([
      "rollover",
      "graduate",
      "advance",
      "progress",
      "carryover",
      "freshmen",
    ]);
    expect(pending[0]?.status).toBe("in_progress");
    // Stage list stays stable (identical ids/order) across outcomes.
    expect(dynastyRolloverProcessStages("error").map((s) => s.id)).toEqual(
      pending.map((s) => s.id),
    );

    const success = dynastyRolloverProcessStages("success", {
      sourceSeason: { id: "s1", name: "2026" },
      targetSeason: { id: "s2", name: "2027" },
      graduation: { players: 12 },
      advancement: { players: 120 },
      progression: { snapshots: 120 },
      carryover: {
        copiedAssignments: 96,
        copiedDepthEntries: 40,
        removedAssignments: 12,
        removedDepthEntries: 6,
      },
      recruiting: { freshmen: 48, toPool: true },
    });
    expect(success.map((stage) => stage.id)).toEqual([
      "rollover",
      "graduate",
      "advance",
      "progress",
      "carryover",
      "freshmen",
    ]);
    expect(success.find((stage) => stage.id === "rollover")?.detail).toBe(
      "2026 → 2027",
    );
    expect(success.find((stage) => stage.id === "graduate")?.detail).toBe(
      "12 players",
    );
    expect(success.find((stage) => stage.id === "advance")?.detail).toBe(
      "120 players",
    );
    expect(success.find((stage) => stage.id === "progress")?.detail).toBe(
      "120 snapshots",
    );
    expect(success.find((stage) => stage.id === "carryover")?.detail).toBe(
      "96 assignments · 40 depth carried, 12 assignments · 6 depth removed",
    );
    expect(success.find((stage) => stage.id === "freshmen")?.detail).toBe(
      "48 players → free-agent pool",
    );
  });
});

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

  it("builds dynasty rollover stages from server counts", () => {
    const pending = dynastyRolloverProcessStages("pending");
    expect(pending.map((stage) => stage.id)).toEqual([
      "rollover",
      "graduate",
      "advance",
      "freshmen",
    ]);
    expect(pending[0]?.status).toBe("in_progress");

    const success = dynastyRolloverProcessStages("success", {
      graduated: 12,
      advanced: 120,
      freshmen: 48,
      progressed: 120,
    });
    expect(success.find((stage) => stage.id === "graduate")?.detail).toBe(
      "12 players",
    );
    expect(success.find((stage) => stage.id === "freshmen")?.detail).toBe(
      "48 players",
    );
    expect(success.find((stage) => stage.id === "progress")?.detail).toBe(
      "120 snapshots",
    );
  });
});

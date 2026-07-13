/**
 * ProcessDialog stage builders for generation flows (WSM-000242).
 * Stages reflect real action boundaries — no simulated progress.
 */
import type { ProcessStage } from "@/components/lifecycle/ProcessDialog";
import type { RolloverOperationSummary } from "@/lib/rollover-summary";

export type ProcessOutcome = "pending" | "success" | "error";

function stage(
  id: string,
  label: string,
  outcome: ProcessOutcome,
  detail?: string,
): ProcessStage {
  return {
    id,
    label,
    status:
      outcome === "pending"
        ? "in_progress"
        : outcome === "success"
          ? "complete"
          : "error",
    detail,
  };
}

function terminalStage(
  id: string,
  label: string,
  outcome: ProcessOutcome,
  detail?: string,
): ProcessStage {
  return {
    id,
    label,
    status:
      outcome === "pending"
        ? "pending"
        : outcome === "success"
          ? "complete"
          : outcome === "error"
            ? "error"
            : "pending",
    detail,
  };
}

export function scheduleProcessStages(
  outcome: ProcessOutcome,
  result?: { created: number; weeks: number; teamCount: number },
): ProcessStage[] {
  const detail =
    outcome === "success" && result
      ? `${result.created} games · ${result.weeks} weeks · ${result.teamCount} teams`
      : undefined;
  return [stage("generate", "Generate round-robin schedule", outcome, detail)];
}

export function rosterGenerateProcessStages(
  outcome: ProcessOutcome,
  scope: "team" | "league",
  result?: { created: number; teams?: number },
): ProcessStage[] {
  const detail =
    outcome === "success" && result
      ? result.teams != null
        ? `${result.created} players across ${result.teams} team${result.teams === 1 ? "" : "s"}`
        : result.created === 0
          ? "Roster already full"
          : `${result.created} player${result.created === 1 ? "" : "s"} added`
      : undefined;
  return [
    stage(
      "fill",
      scope === "league" ? "Fill league rosters" : "Fill team roster",
      outcome,
      detail,
    ),
  ];
}

export function rosterClearProcessStages(
  outcome: ProcessOutcome,
  scope: "team" | "league",
  result?: { deleted: number; teams?: number },
): ProcessStage[] {
  const detail =
    outcome === "success" && result
      ? result.teams != null
        ? `${result.deleted} players removed across ${result.teams} team${result.teams === 1 ? "" : "s"}`
        : result.deleted === 0
          ? "No synthetic players to remove"
          : `${result.deleted} player${result.deleted === 1 ? "" : "s"} removed`
      : undefined;
  return [
    stage(
      "clear",
      scope === "league" ? "Clear league synthetic players" : "Clear synthetic players",
      outcome,
      detail,
    ),
  ];
}

export function rosterAttributesProcessStages(
  outcome: ProcessOutcome,
  scope: "team" | "league",
  result?: { rated: number; teams?: number },
): ProcessStage[] {
  const detail =
    outcome === "success" && result
      ? result.teams != null
        ? `${result.rated} ratings across ${result.teams} team${result.teams === 1 ? "" : "s"}`
        : result.rated === 0
          ? "No players to rate"
          : `${result.rated} player${result.rated === 1 ? "" : "s"} rated`
      : undefined;
  return [
    stage(
      "rate",
      scope === "league" ? "Generate league ratings" : "Generate team ratings",
      outcome,
      detail,
    ),
  ];
}

export function rosterAutoFillProcessStages(
  outcome: ProcessOutcome,
  result?: { created: number; teamsFilled: number },
): ProcessStage[] {
  const detail =
    outcome === "success" && result
      ? result.created === 0
        ? "All targeted rosters already full"
        : `${result.created} players across ${result.teamsFilled} team${result.teamsFilled === 1 ? "" : "s"}`
      : undefined;
  return [stage("autofill", "Auto-fill undersized rosters", outcome, detail)];
}

function players(count: number): string {
  return `${count} player${count === 1 ? "" : "s"}`;
}

/**
 * Dynasty rollover process stages threaded from the persisted
 * RolloverOperationSummary (WSM-000243). The stage list is stable across
 * pending/success/error so the process dialog never reorders; on success each
 * detail reflects a real persisted count — source claim/target creation,
 * graduation, advancement, progression, roster carryover, and recruiting. No
 * simulated progress or timed percentages.
 */
export function dynastyRolloverProcessStages(
  outcome: ProcessOutcome,
  summary?: RolloverOperationSummary,
): ProcessStage[] {
  const terminalOutcome = outcome === "pending" ? "pending" : outcome;
  const withSummary = outcome === "success" && summary ? summary : undefined;

  const rolloverDetail = withSummary
    ? `${withSummary.sourceSeason.name} → ${withSummary.targetSeason.name}`
    : undefined;
  const graduateDetail = withSummary
    ? players(withSummary.graduation.players)
    : undefined;
  const advanceDetail = withSummary
    ? players(withSummary.advancement.players)
    : undefined;
  const progressDetail = withSummary
    ? `${withSummary.progression.snapshots} snapshot${
        withSummary.progression.snapshots === 1 ? "" : "s"
      }`
    : undefined;
  const carryoverDetail = withSummary
    ? `${withSummary.carryover.copiedAssignments} assignment${
        withSummary.carryover.copiedAssignments === 1 ? "" : "s"
      } · ${withSummary.carryover.copiedDepthEntries} depth carried, ${
        withSummary.carryover.removedAssignments
      } assignment${
        withSummary.carryover.removedAssignments === 1 ? "" : "s"
      } · ${withSummary.carryover.removedDepthEntries} depth removed`
    : undefined;
  const freshmanDetail = withSummary
    ? `${players(withSummary.recruiting.freshmen)}${
        withSummary.recruiting.toPool ? " → free-agent pool" : ""
      }`
    : undefined;

  return [
    stage("rollover", "Start next season", outcome, rolloverDetail),
    terminalStage("graduate", "Graduate seniors", terminalOutcome, graduateDetail),
    terminalStage(
      "advance",
      "Advance class years",
      terminalOutcome,
      advanceDetail,
    ),
    terminalStage(
      "progress",
      "Write attribute progression",
      terminalOutcome,
      progressDetail,
    ),
    terminalStage(
      "carryover",
      "Carry over rosters",
      terminalOutcome,
      carryoverDetail,
    ),
    terminalStage("freshmen", "Generate freshmen", terminalOutcome, freshmanDetail),
  ];
}

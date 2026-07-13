/**
 * ProcessDialog stage builders for generation flows (WSM-000242).
 * Stages reflect real action boundaries — no simulated progress.
 */
import type { ProcessStage } from "@/components/lifecycle/ProcessDialog";

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

export function dynastyRolloverProcessStages(
  outcome: ProcessOutcome,
  result?: {
    graduated: number;
    advanced: number;
    freshmen: number;
    progressed?: number;
  },
): ProcessStage[] {
  const graduateDetail =
    outcome === "success" && result
      ? `${result.graduated} player${result.graduated === 1 ? "" : "s"}`
      : undefined;
  const advanceDetail =
    outcome === "success" && result
      ? `${result.advanced} player${result.advanced === 1 ? "" : "s"}`
      : undefined;
  const freshmanDetail =
    outcome === "success" && result
      ? `${result.freshmen} player${result.freshmen === 1 ? "" : "s"}`
      : undefined;
  const progressDetail =
    outcome === "success" && result && (result.progressed ?? 0) > 0
      ? `${result.progressed} snapshot${result.progressed === 1 ? "" : "s"}`
      : undefined;

  const graduate = terminalStage(
    "graduate",
    "Graduate seniors",
    outcome === "pending" ? "pending" : outcome,
    graduateDetail,
  );
  const advance = terminalStage(
    "advance",
    "Advance class years",
    outcome === "pending" ? "pending" : outcome,
    advanceDetail,
  );
  const freshmen = terminalStage(
    "freshmen",
    "Generate freshmen",
    outcome === "pending" ? "pending" : outcome,
    freshmanDetail,
  );

  if (outcome === "pending") {
    return [
      stage("rollover", "Start next season", "pending"),
      graduate,
      advance,
      freshmen,
    ];
  }

  const stages: ProcessStage[] = [
    stage("rollover", "Start next season", outcome),
    graduate,
    advance,
    freshmen,
  ];

  if (progressDetail) {
    stages.push(
      terminalStage("progress", "Write attribute progression", outcome, progressDetail),
    );
  }

  return stages;
}

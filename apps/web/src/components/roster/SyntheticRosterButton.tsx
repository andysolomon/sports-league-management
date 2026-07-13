"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Trash2, Gauge } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActionConfirmDialog } from "@/components/lifecycle/ActionConfirmDialog";
import { ProcessDialog } from "@/components/lifecycle/ProcessDialog";
import {
  generateTeamRosterAction,
  generateLeagueRostersAction,
  clearTeamSyntheticAction,
  clearLeagueSyntheticAction,
  generateTeamAttributesAction,
  generateLeagueAttributesAction,
} from "@/app/dashboard/_actions/synthetic-rosters";
import {
  rosterAttributesProcessStages,
  rosterClearProcessStages,
  rosterGenerateProcessStages,
} from "@/lib/process-stages";
import type { ProcessStage } from "@/components/lifecycle/ProcessDialog";

/*
 * Generate or clear synthetic (fake) players for testing/demos (WSM-000173).
 * `team` acts on one team; `league` acts on every team (admin-only). Clear only
 * ever deletes generator-created players (flagged `synthetic`), never real
 * entries. Gated upstream by the syntheticRostersV1 flag + role (the parent
 * only renders this when allowed).
 */
interface SyntheticRosterButtonProps {
  kind: "team" | "league";
  id: string;
  action?: "generate" | "clear" | "attributes";
  /** When true, generate/attributes actions are disabled (season already started). */
  seasonStarted?: boolean;
}

export function SyntheticRosterButton({
  kind,
  id,
  action = "generate",
  seasonStarted = false,
}: SyntheticRosterButtonProps) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [processOpen, setProcessOpen] = useState(false);
  const [processError, setProcessError] = useState<string | null>(null);
  const [stages, setStages] = useState<ProcessStage[]>(
    initialStages(action, kind),
  );

  function beginProcess() {
    setConfirmOpen(false);
    setProcessOpen(true);
    setProcessError(null);
    setStages(initialStages(action, kind));
  }

  function run() {
    beginProcess();
    start(async () => {
      if (action === "attributes" && kind === "team") {
        const res = await generateTeamAttributesAction({ teamId: id });
        if (!res.ok) {
          setStages(rosterAttributesProcessStages("error", kind));
          setProcessError(errorLabel(res.error));
          return;
        }
        setStages(
          rosterAttributesProcessStages("success", kind, { rated: res.rated }),
        );
      } else if (action === "attributes") {
        const res = await generateLeagueAttributesAction({ leagueId: id });
        if (!res.ok) {
          setStages(rosterAttributesProcessStages("error", kind));
          setProcessError(errorLabel(res.error));
          return;
        }
        setStages(
          rosterAttributesProcessStages("success", kind, {
            rated: res.rated,
            teams: res.teams,
          }),
        );
      } else if (action === "generate" && kind === "team") {
        const res = await generateTeamRosterAction({ teamId: id });
        if (!res.ok) {
          setStages(rosterGenerateProcessStages("error", kind));
          setProcessError(errorLabel(res.error));
          return;
        }
        setStages(
          rosterGenerateProcessStages("success", kind, { created: res.created }),
        );
      } else if (action === "generate") {
        const res = await generateLeagueRostersAction({ leagueId: id });
        if (!res.ok) {
          setStages(rosterGenerateProcessStages("error", kind));
          setProcessError(errorLabel(res.error));
          return;
        }
        setStages(
          rosterGenerateProcessStages("success", kind, {
            created: res.created,
            teams: res.teams,
          }),
        );
      } else if (kind === "team") {
        const res = await clearTeamSyntheticAction({ teamId: id });
        if (!res.ok) {
          setStages(rosterClearProcessStages("error", kind));
          setProcessError(errorLabel(res.error));
          return;
        }
        setStages(
          rosterClearProcessStages("success", kind, { deleted: res.deleted }),
        );
      } else {
        const res = await clearLeagueSyntheticAction({ leagueId: id });
        if (!res.ok) {
          setStages(rosterClearProcessStages("error", kind));
          setProcessError(errorLabel(res.error));
          return;
        }
        setStages(
          rosterClearProcessStages("success", kind, {
            deleted: res.deleted,
            teams: res.teams,
          }),
        );
      }
      router.refresh();
    });
  }

  const isClear = action === "clear";
  const isAttributes = action === "attributes";
  const blockedBySeason = seasonStarted && !isClear;
  const Icon = isClear ? Trash2 : isAttributes ? Gauge : Sparkles;
  const label = isClear
    ? pending
      ? "Clearing…"
      : "Clear synthetic"
    : isAttributes
      ? pending
        ? "Rating…"
        : "Generate ratings"
      : pending
        ? "Generating…"
        : kind === "team"
          ? "Generate roster"
          : "Generate rosters";

  const processTitle = isClear
    ? "Clear synthetic players"
    : isAttributes
      ? "Generate ratings"
      : "Generate synthetic roster";
  const processDescription = CONFIRM[action][kind];

  return (
    <>
      <Button
        type="button"
        variant={isClear ? "ghost" : "outline"}
        size="sm"
        disabled={pending || blockedBySeason}
        onClick={() => setConfirmOpen(true)}
        className={isClear ? "text-destructive hover:text-destructive" : undefined}
        title={
          blockedBySeason
            ? SEASON_STARTED_HINT
            : isClear
              ? "Delete generated test players (keeps real players)"
              : isAttributes
                ? "Generate Madden-style ratings for this roster's players (test data)"
                : "Generate fake players to populate this roster for testing/demos"
        }
      >
        <Icon className="mr-1 h-4 w-4" />
        {label}
      </Button>
      <ActionConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={isClear ? "Clear synthetic players?" : isAttributes ? "Generate ratings?" : "Generate synthetic roster?"}
        description={CONFIRM[action][kind]}
        confirmLabel={isClear ? "Clear" : isAttributes ? "Generate" : "Generate"}
        destructive={isClear}
        pending={pending}
        onConfirm={run}
      />
      <ProcessDialog
        open={processOpen}
        onOpenChange={setProcessOpen}
        title={processTitle}
        description={processDescription}
        stages={stages}
        pending={pending}
        error={processError}
        onRetry={run}
      />
    </>
  );
}

function initialStages(
  action: "generate" | "clear" | "attributes",
  kind: "team" | "league",
): ProcessStage[] {
  if (action === "clear") return rosterClearProcessStages("pending", kind);
  if (action === "attributes") return rosterAttributesProcessStages("pending", kind);
  return rosterGenerateProcessStages("pending", kind);
}

const CONFIRM: Record<
  "generate" | "clear" | "attributes",
  Record<"team" | "league", string>
> = {
  generate: {
    team: "Generate a synthetic (fake) roster for this team? These are test players, not real people.",
    league:
      "Generate synthetic (fake) rosters for ALL teams in this league? These are test players, not real people.",
  },
  clear: {
    team: "Delete all synthetic (generated) players from this team? Real players are kept.",
    league:
      "Delete all synthetic (generated) players from EVERY team in this league? Real players are kept.",
  },
  attributes: {
    team: "Generate Madden-style ratings for this team's players? Test data — overwrites any existing synthetic ratings for the active season.",
    league:
      "Generate Madden-style ratings for EVERY team's players in this league? Test data — overwrites existing synthetic ratings for the active season.",
  },
};

const SEASON_STARTED_HINT =
  "Season has started — roster and ratings generation is locked.";

function errorLabel(error: string): string {
  switch (error) {
    case "flag_disabled":
      return "Synthetic rosters aren't enabled.";
    case "unauthorized":
      return "Please sign in.";
    case "not_authorized":
      return "You don't have permission to do that.";
    case "no_season":
      return "This league has no season yet — create one first.";
    case "season_started":
      return SEASON_STARTED_HINT;
    default:
      return error;
  }
}

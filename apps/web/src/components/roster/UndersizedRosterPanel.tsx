"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProcessDialog } from "@/components/lifecycle/ProcessDialog";
import { fillDeficientRostersAction } from "@/app/dashboard/_actions/synthetic-rosters";
import { rosterAutoFillProcessStages } from "@/lib/process-stages";
import {
  undersizedRosterSummaryMessage,
  type UndersizedTeamWithDeficit,
} from "@/lib/roster-deficit";

export interface UndersizedRosterPanelProps {
  leagueId: string;
  target: number;
  undersizedTeams: UndersizedTeamWithDeficit[];
  canAutoFill: boolean;
}

export function UndersizedRosterPanel({
  leagueId,
  target,
  undersizedTeams,
  canAutoFill,
}: UndersizedRosterPanelProps) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [processOpen, setProcessOpen] = useState(false);
  const [processError, setProcessError] = useState<string | null>(null);
  const [stages, setStages] = useState(
    rosterAutoFillProcessStages("pending"),
  );

  if (undersizedTeams.length === 0) return null;

  function runAutoFill() {
    setProcessOpen(true);
    setProcessError(null);
    setStages(rosterAutoFillProcessStages("pending"));

    start(async () => {
      const res = await fillDeficientRostersAction({ leagueId });
      if (!res.ok) {
        setStages(rosterAutoFillProcessStages("error"));
        setProcessError(errorLabel(res.error));
        return;
      }
      setStages(
        rosterAutoFillProcessStages("success", {
          created: res.created,
          teamsFilled: res.teamsFilled,
        }),
      );
      router.refresh();
    });
  }

  return (
    <>
      <div
        className="rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3"
        data-testid="undersized-roster-panel"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-2">
            <p className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
              Undersized rosters
            </p>
            <p className="text-sm text-muted-foreground">
              {undersizedRosterSummaryMessage(undersizedTeams, target)}
            </p>
            <ul className="text-sm text-foreground" data-testid="undersized-roster-list">
              {undersizedTeams.map((team) => (
                <li key={team.id}>
                  {team.name}{" "}
                  <span className="text-muted-foreground">
                    ({team.activeCount}/{target})
                  </span>
                </li>
              ))}
            </ul>
          </div>
          {canAutoFill ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={runAutoFill}
              data-testid="undersized-roster-autofill"
            >
              {pending ? "Auto-filling…" : "Auto-fill rosters"}
            </Button>
          ) : null}
        </div>
      </div>

      <ProcessDialog
        open={processOpen}
        onOpenChange={setProcessOpen}
        title="Auto-fill rosters"
        description="Filling only teams below the roster target."
        stages={stages}
        pending={pending}
        error={processError}
        onRetry={runAutoFill}
      />
    </>
  );
}

function errorLabel(error: string): string {
  switch (error) {
    case "flag_disabled":
      return "Synthetic rosters aren't enabled.";
    case "unauthorized":
      return "Please sign in.";
    case "not_authorized":
      return "You don't have permission to auto-fill rosters.";
    case "season_started":
      return "Season has started — roster generation is locked.";
    default:
      return error;
  }
}

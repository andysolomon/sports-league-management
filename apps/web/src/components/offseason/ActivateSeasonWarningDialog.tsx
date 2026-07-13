"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { UndersizedTeam } from "@/lib/offseason-activate";
import { activateSeasonWarningMessage } from "@/lib/offseason-activate";
import { fillDeficientRostersAction } from "@/app/dashboard/_actions/synthetic-rosters";
import { rosterAutoFillProcessStages } from "@/lib/process-stages";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ProcessDialog } from "@/components/lifecycle/ProcessDialog";

export interface ActivateSeasonWarningDialogProps {
  open: boolean;
  seasonName: string;
  leagueId: string;
  undersizedTeams: UndersizedTeam[];
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
}

export function ActivateSeasonWarningDialog({
  open,
  seasonName,
  leagueId,
  undersizedTeams,
  busy,
  onCancel,
  onConfirm,
}: ActivateSeasonWarningDialogProps) {
  const router = useRouter();
  const [autoFillPending, startAutoFill] = useTransition();
  const [processOpen, setProcessOpen] = useState(false);
  const [processError, setProcessError] = useState<string | null>(null);
  const [stages, setStages] = useState(rosterAutoFillProcessStages("pending"));

  const pending = busy || autoFillPending;

  function runAutoFill() {
    setProcessOpen(true);
    setProcessError(null);
    setStages(rosterAutoFillProcessStages("pending"));

    startAutoFill(async () => {
      const res = await fillDeficientRostersAction({ leagueId });
      if (!res.ok) {
        setStages(rosterAutoFillProcessStages("error"));
        setProcessError(autoFillErrorLabel(res.error));
        return;
      }
      setStages(
        rosterAutoFillProcessStages("success", {
          created: res.created,
          teamsFilled: res.teamsFilled,
        }),
      );
      router.refresh();
      setProcessOpen(false);
      await onConfirm();
    });
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => !next && !pending && onCancel()}>
        <DialogContent data-testid="activate-season-warning-dialog">
          <DialogHeader>
            <DialogTitle>Activate with undersized rosters?</DialogTitle>
            <DialogDescription>
              {activateSeasonWarningMessage(undersizedTeams)}
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Proceed to make{" "}
            <span className="font-medium text-foreground">{seasonName}</span> the
            active season anyway?
          </p>
          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={runAutoFill}
              data-testid="activate-season-autofill"
            >
              {autoFillPending ? "Auto-filling…" : "Auto-fill rosters"}
            </Button>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" disabled={pending} onClick={onCancel}>
                Cancel
              </Button>
              <Button
                type="button"
                disabled={pending}
                onClick={() => void onConfirm()}
                data-testid="activate-season-warning-confirm"
              >
                {busy ? "Activating…" : "Proceed anyway"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ProcessDialog
        open={processOpen}
        onOpenChange={setProcessOpen}
        title="Auto-fill rosters"
        description="Filling only teams below the roster target."
        stages={stages}
        pending={autoFillPending}
        error={processError}
        onRetry={runAutoFill}
      />
    </>
  );
}

function autoFillErrorLabel(error: string): string {
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
